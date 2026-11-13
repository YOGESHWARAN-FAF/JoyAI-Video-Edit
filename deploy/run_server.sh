#!/bin/bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

JOYOMNI_CONDA_SH="${JOYOMNI_CONDA_SH:-}"
JOYOMNI_CONDA_ENV="${JOYOMNI_CONDA_ENV:-joyai-video-edit}"

if [ -z "$JOYOMNI_CONDA_SH" ]; then
  for cand_sh in \
    "$HOME/miniconda3/etc/profile.d/conda.sh" \
    "$HOME/anaconda3/etc/profile.d/conda.sh" \
    "/opt/conda/etc/profile.d/conda.sh"; do
    if [ -f "$cand_sh" ]; then
      JOYOMNI_CONDA_SH="$cand_sh"
      break
    fi
  done
fi

if [ -n "$JOYOMNI_CONDA_SH" ] && [ -f "$JOYOMNI_CONDA_SH" ]; then
  # shellcheck disable=SC1090
  source "$JOYOMNI_CONDA_SH"
  conda activate "$JOYOMNI_CONDA_ENV" 2>/dev/null || true
  hash -r
fi

PYTHON_BIN="python"
if ! "$PYTHON_BIN" -c "import torch" &>/dev/null; then
  for cand_py in \
    "$HOME/miniconda3/envs/$JOYOMNI_CONDA_ENV/bin/python" \
    "$HOME/anaconda3/envs/$JOYOMNI_CONDA_ENV/bin/python" \
    "/opt/conda/envs/$JOYOMNI_CONDA_ENV/bin/python"; do
    if [ -x "$cand_py" ]; then
      PYTHON_BIN="$cand_py"
      break
    fi
  done
fi

cd "$HERE"

JOYOMNI_CACHE_ROOT="${JOYOMNI_CACHE_ROOT:-$HERE/deps/cache}"
export TORCHINDUCTOR_CACHE_DIR="${TORCHINDUCTOR_CACHE_DIR:-$JOYOMNI_CACHE_ROOT/torchinductor}"
export TRITON_CACHE_DIR="${TRITON_CACHE_DIR:-$JOYOMNI_CACHE_ROOT/triton}"
export CUDA_CACHE_PATH="${CUDA_CACHE_PATH:-$JOYOMNI_CACHE_ROOT/nv_compute}"
export TORCHINDUCTOR_FX_GRAPH_CACHE=1
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:True}"
export PYTORCH_ALLOC_CONF="${PYTORCH_ALLOC_CONF:-expandable_segments:True}"
mkdir -p "$TORCHINDUCTOR_CACHE_DIR" "$TRITON_CACHE_DIR" "$CUDA_CACHE_PATH"

# Pre-flight GPU VRAM check and stale process cleanup
JOYOMNI_CLEAN_GPU="${JOYOMNI_CLEAN_GPU:-1}"
if command -v nvidia-smi &>/dev/null; then
  set +eo pipefail
  if [ "$JOYOMNI_CLEAN_GPU" = "1" ]; then
    OCCUPIED_PIDS=$(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits 2>/dev/null)
    if [ -n "$OCCUPIED_PIDS" ]; then
      echo "#####[PREFLIGHT] Found active compute process(es) on GPU: $OCCUPIED_PIDS"
      for p in $OCCUPIED_PIDS; do
        if [ -n "$p" ] && [ "$p" != "$$" ]; then
          echo "#####[PREFLIGHT] Terminating stale GPU process PID $p..."
          kill -9 "$p" 2>/dev/null || true
        fi
      done
      sleep 1
    fi
  fi
  GPU_VRAM=$(nvidia-smi --query-gpu=memory.total,memory.free,memory.used --format=csv,noheader 2>/dev/null || true)
  echo "#####[PREFLIGHT] GPU 0 VRAM (Total, Free, Used): $GPU_VRAM"
  set -eo pipefail
fi

# Pre-flight port check: terminate any stale process holding PORT (8080)
PORT="${JOYOMNI_PORT:-8080}"
if command -v fuser &>/dev/null; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
elif command -v lsof &>/dev/null; then
  lsof -ti :"${PORT}" | xargs kill -9 2>/dev/null || true
elif command -v ss &>/dev/null; then
  STALE_PID=$(ss -lptn "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -n1 || true)
  if [ -n "$STALE_PID" ]; then
    kill -9 "$STALE_PID" 2>/dev/null || true
  fi
fi
sleep 0.5

export PYTHONUNBUFFERED=1
export PYTHONNOUSERSITE="${PYTHONNOUSERSITE:-1}"
export PYTHONPATH="$HERE"

export JOYOMNI_FP8_IMG="${JOYOMNI_FP8_IMG:-1}"
export JOYOMNI_FP8_TXT="${JOYOMNI_FP8_TXT:-1}"
export JOYOMNI_CUDA_GRAPH="${JOYOMNI_CUDA_GRAPH:-1}"
export JOYOMNI_SAGE_ATTN="${JOYOMNI_SAGE_ATTN:-0}"
export JOYOMNI_FA4_ATTN="${JOYOMNI_FA4_ATTN:-1}"
export JOYOMNI_FP8_FAST_ACCUM="${JOYOMNI_FP8_FAST_ACCUM:-1}"
export JOYOMNI_LOW_VRAM="${JOYOMNI_LOW_VRAM:-1}"
export JOYOMNI_TRIAL_DURATION_S="${JOYOMNI_TRIAL_DURATION_S:-15}"
export JOYOMNI_SHARPNESS="${JOYOMNI_SHARPNESS:-0.42}"
export JOYOMNI_OUTPUT_QUALITY="${JOYOMNI_OUTPUT_QUALITY:-95}"
export JOYOMNI_PRESERVE_BACKGROUND="${JOYOMNI_PRESERVE_BACKGROUND:-0}"
export JOYOMNI_REF_BASESIZE="${JOYOMNI_REF_BASESIZE:-768}"
export JOYOMNI_WIDTH="${JOYOMNI_WIDTH:-600}"
export JOYOMNI_HEIGHT="${JOYOMNI_HEIGHT:-1080}"
export JOYOMNI_FPS="${JOYOMNI_FPS:-24}"

# Local Qwen PE; select api for an external PE endpoint.
export JOYOMNI_PE_BACKEND="${JOYOMNI_PE_BACKEND:-none}"
export PE_MODEL="${PE_MODEL:-}"
export OPENAI_BASE_URL="${OPENAI_BASE_URL:-}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-}"

RECORD_DIR="${JOYOMNI_RECORD_DIR:-$HERE/recordings}"

CKPT_ROOT="${JOYOMNI_CKPT_ROOT:-$HERE/deps/checkpoints}"
export JOYOMNI_PE_CKPT="${JOYOMNI_PE_CKPT:-$CKPT_ROOT/Qwen3.6-27B-GPTQ-Int4-FOEM}"
DIT_CKPT="${JOYOMNI_DIT_CKPT:-$CKPT_ROOT/JoyAI-Video-Edit/dit/joyai_video_edit_dit_1101_face++.pth}"
VAE_CKPT="${JOYOMNI_VAE_CKPT:-$CKPT_ROOT/JoyAI-Video-Edit/vae}"
TE_CKPT="${JOYOMNI_TEXT_ENCODER_CKPT:-$CKPT_ROOT/MiMo-VL-7B-RL-2508}"
FACE_ONNX="${JOYOMNI_FACE_ONNX:-$CKPT_ROOT/face_detection_yunet_2023mar.onnx}"
PERSON_ONNX="${JOYOMNI_PERSON_ONNX:-$CKPT_ROOT/yolov8n.onnx}"

DEVICE="${JOYOMNI_DEVICE:-cuda:0}"
HOST="${JOYOMNI_HOST:-0.0.0.0}"
PORT="${JOYOMNI_PORT:-8080}"

"$PYTHON_BIN" xvideo/serving/serve_joyomni_streaming.py \
  --dit-ckpt          "$DIT_CKPT" \
  --vae-ckpt          "$VAE_CKPT" \
  --text-encoder-ckpt "$TE_CKPT" \
  --face-detector-onnx   "$FACE_ONNX" \
  --person-detector-onnx "$PERSON_ONNX" \
  --record-dir "$RECORD_DIR" \
  --device "$DEVICE" \
  --vae-encode-device "$DEVICE" \
  --vae-decode-device "$DEVICE" \
  --vae-pseudo-device "$DEVICE" \
  --postprocess-device "$DEVICE" \
  --width "${JOYOMNI_WIDTH:-600}" --height "${JOYOMNI_HEIGHT:-1080}" \
  --fps "${JOYOMNI_FPS:-24}" \
  --output-quality "${JOYOMNI_OUTPUT_QUALITY:-95}" \
  --trial-duration-s "${JOYOMNI_TRIAL_DURATION_S:-15}" \
  --pe-timeout-s "${JOYOMNI_PE_TIMEOUT_S:-60}" \
  --host "$HOST" --port "$PORT" \
  "$@"
