#!/bin/bash
# ==========================================================
#     JoyAI-Video-Edit Launch Script for Ubuntu Server
# ==========================================================

export PYTHONNOUSERSITE=1

PORT=${PORT:-8090}
HOST=${HOST:-"0.0.0.0"}
GPU_ID=${GPU_ID:-0}
WIDTH=${WIDTH:-840}
HEIGHT=${HEIGHT:-480}
FPS=${FPS:-24}
FORCE_NO_PE=""
FORCE_QWEN=""
ENABLE_TUNNEL=1

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --port)
            PORT="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --gpu)
            GPU_ID="$2"
            shift 2
            ;;
        --width)
            WIDTH="$2"
            shift 2
            ;;
        --height)
            HEIGHT="$2"
            shift 2
            ;;
        --fps)
            FPS="$2"
            shift 2
            ;;
        --qwen)
            FORCE_QWEN="1"
            shift
            ;;
        --no-pe)
            FORCE_NO_PE="1"
            shift
            ;;
        --720p)
            WIDTH=1248
            HEIGHT=720
            FPS=16
            shift
            ;;
        --no-tunnel)
            ENABLE_TUNNEL=0
            shift
            ;;
        --tunnel)
            ENABLE_TUNNEL=1
            shift
            ;;
        --help|-h)
            echo "Usage: bash run.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --port <PORT>      Server port (default: 8090)"
            echo "  --host <HOST>      Host binding address (default: 0.0.0.0)"
            echo "  --gpu <ID>         CUDA GPU device index (default: 0)"
            echo "  --width <W>        Video width (default: 840)"
            echo "  --height <H>       Video height (default: 480)"
            echo "  --fps <FPS>        Streaming FPS (default: 24)"
            echo "  --720p             Preset for 720p (1248x720 @ 16 FPS)"
            echo "  --qwen             Use local Qwen3.5-35B PE checkpoint"
            echo "  --no-pe            Run in raw direct prompt mode (no PE)"
            echo "  --tunnel           Enable public Cloudflare URL (default: enabled)"
            echo "  --no-tunnel        Disable public Cloudflare URL"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

# Locate Conda and Environment Python
JOY_PYTHON=""
if [ "$CONDA_DEFAULT_ENV" = "joyai-video-edit" ] && command -v python &>/dev/null; then
    JOY_PYTHON=$(command -v python)
fi

if [ -z "$JOY_PYTHON" ]; then
    for c_path in "$HOME/miniconda3" "$HOME/anaconda3" "/opt/conda" "$HOME/miniconda" "$HOME/miniforge3"; do
        if [ -f "$c_path/envs/joyai-video-edit/bin/python" ]; then
            JOY_PYTHON="$c_path/envs/joyai-video-edit/bin/python"
            break
        fi
    done
fi

if [ -z "$JOY_PYTHON" ] && command -v conda &>/dev/null; then
    CONDA_BASE=$(conda info --base 2>/dev/null)
    if [ -f "$CONDA_BASE/envs/joyai-video-edit/bin/python" ]; then
        JOY_PYTHON="$CONDA_BASE/envs/joyai-video-edit/bin/python"
    fi
fi

if [ -z "$JOY_PYTHON" ] || [ ! -f "$JOY_PYTHON" ]; then
    echo "[!] Error: 'joyai-video-edit' conda environment not found!"
    echo "    Please run setup script first:"
    echo "        bash setup.sh"
    exit 1
fi

export PATH="$(dirname "$JOY_PYTHON"):$PATH"
export JOYOMNI_CONDA_ENV=""

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

export CUDA_VISIBLE_DEVICES="$GPU_ID"
export PYTHONUNBUFFERED=1
export JOYOMNI_DEVICE="cuda:0"
export JOYOMNI_HOST="$HOST"
export JOYOMNI_PORT="$PORT"
export JOYOMNI_WIDTH="$WIDTH"
export JOYOMNI_HEIGHT="$HEIGHT"
export JOYOMNI_FPS="$FPS"

# Optimized runtime configuration for NVIDIA L40S / Ada Lovelace / Consumer GPUs
export JOYOMNI_FA4_ATTN=0
export JOYOMNI_SAGE_ATTN=0
export JOYOMNI_CUDA_GRAPH=1
export JOYOMNI_LOW_VRAM=1

# Check FP8 support in joyomni_ops
if "$JOY_PYTHON" -c "import joyomni_ops; exit(0 if joyomni_ops.has_fp8() else 1)" 2>/dev/null; then
    export JOYOMNI_FP8_IMG=1
    export JOYOMNI_FP8_TXT=1
    FP8_STATUS="Enabled (CUTLASS FP8 GEMM)"
else
    export JOYOMNI_FP8_IMG=0
    export JOYOMNI_FP8_TXT=0
    FP8_STATUS="Disabled (BF16 fallback)"
fi

# Configure Prompt Enhancement (PE) backend
QWEN_DIR="$REPO_ROOT/deploy/deps/checkpoints/Qwen3.5-35B-A3B-GPTQ-Int4"
if [ -n "$FORCE_NO_PE" ]; then
    export JOYOMNI_PE_BACKEND="api"
    PE_STATUS="Raw Prompt Mode (--no-pe)"
elif [ -n "$FORCE_QWEN" ] || [ -d "$QWEN_DIR" ]; then
    export JOYOMNI_PE_BACKEND="qwen"
    PE_STATUS="Local Qwen3.5-35B INT4"
else
    export JOYOMNI_PE_BACKEND="api"
    PE_STATUS="Raw Prompt Mode (Qwen not installed, runs directly)"
fi

echo "=========================================================="
echo "          Launching JoyAI-Video-Edit Server               "
echo "=========================================================="
echo "[+] Python:        $JOY_PYTHON"
echo "[+] Device:        GPU $GPU_ID (CUDA_VISIBLE_DEVICES=$GPU_ID)"
echo "[+] Port:          $PORT"
echo "[+] Resolution:    ${WIDTH}x${HEIGHT} @ ${FPS} FPS"
echo "[+] FP8 Engine:    $FP8_STATUS"
echo "[+] PE Engine:     $PE_STATUS"
echo "[+] Low VRAM Mode: $JOYOMNI_LOW_VRAM"
echo "[+] Local URL:     http://localhost:$PORT"
echo "[+] Network URL:   http://$HOST:$PORT"

# Start Cloudflare Public Tunnel for instant browser access
if [ "$ENABLE_TUNNEL" = "1" ]; then
    CLOUDFLARED_BIN="$REPO_ROOT/deploy/tmp/cloudflared"
    if [ ! -f "$CLOUDFLARED_BIN" ]; then
        echo "[+] Downloading cloudflared for instant HTTPS public URL..."
        mkdir -p "$REPO_ROOT/deploy/tmp"
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O "$CLOUDFLARED_BIN" 2>/dev/null || true
        chmod +x "$CLOUDFLARED_BIN" 2>/dev/null || true
    fi

    if [ -x "$CLOUDFLARED_BIN" ]; then
        CLOUDFLARE_LOG="$REPO_ROOT/deploy/tmp/cloudflared.log"
        rm -f "$CLOUDFLARE_LOG"
        "$CLOUDFLARED_BIN" tunnel --url "http://127.0.0.1:$PORT" > "$CLOUDFLARE_LOG" 2>&1 &
        CF_PID=$!
        trap "kill $CF_PID 2>/dev/null || true" EXIT

        # Background listener to display public URL as soon as generated
        (
            for i in {1..20}; do
                sleep 1
                if [ -f "$CLOUDFLARE_LOG" ]; then
                    PUBLIC_URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' "$CLOUDFLARE_LOG" | head -n 1)
                    if [ -n "$PUBLIC_URL" ]; then
                        echo ""
                        echo "=========================================================="
                        echo "  🌐 PUBLIC BROWSER URL (HTTPS + WSS):"
                        echo "  👉 $PUBLIC_URL"
                        echo "=========================================================="
                        echo ""
                        break
                    fi
                fi
            done
        ) &
    fi
fi

echo "=========================================================="

EXTRA_ARGS=""
if [ "$JOYOMNI_PE_BACKEND" = "api" ] && [ -z "${OPENAI_API_KEY:-}" ]; then
    EXTRA_ARGS="--no-use-pe"
fi

bash "$REPO_ROOT/deploy/run_server.sh" $EXTRA_ARGS
