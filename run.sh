#!/bin/bash
# ==========================================================
#     JoyAI-Video-Edit Launch Script for Ubuntu Server
# ==========================================================

export PYTHONNOUSERSITE=1
export JOYOMNI_SKIP_LOAD_WARMUP=1
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:True}"

PORT=${PORT:-8090}
HOST=${HOST:-"0.0.0.0"}
GPU_ID=${GPU_ID:-0}
WIDTH=${WIDTH:-840}
HEIGHT=${HEIGHT:-480}
FPS=${FPS:-24}
FORCE_NO_PE=""
FORCE_QWEN=""
ENABLE_TUNNEL=1
ENABLE_PINGGY=0
ENABLE_NGROK=0
NGROK_AUTHTOKEN="${NGROK_AUTHTOKEN:-}"
API_KEY="${JOYOMNI_API_KEY:-}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --api-key)
            API_KEY="$2"
            shift 2
            ;;
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
        --ngrok)
            ENABLE_NGROK=1
            if [[ -n "${2:-}" && ! "$2" =~ ^-- ]]; then
                NGROK_AUTHTOKEN="$2"
                shift 2
            else
                shift 1
            fi
            ;;
        --ngrok-token)
            NGROK_AUTHTOKEN="$2"
            ENABLE_NGROK=1
            shift 2
            ;;
        --no-cloudflare|--no-tunnel)
            ENABLE_TUNNEL=0
            shift
            ;;
        --cloudflare|--tunnel)
            ENABLE_TUNNEL=1
            shift
            ;;
        --pinggy)
            ENABLE_PINGGY=1
            shift
            ;;
        --no-graph|--no-cuda-graph)
            export JOYOMNI_CUDA_GRAPH=0
            shift
            ;;
        --low-vram)
            export JOYOMNI_LOW_VRAM=1
            shift
            ;;
        --no-low-vram)
            export JOYOMNI_LOW_VRAM=0
            shift
            ;;
        --kill-zombies|-k)
            KILL_ZOMBIES=1
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
            echo "  --low-vram         Enable progressive FP8 staging (default on, fits ≤48GB cards)"
            echo "  --no-low-vram      Disable progressive staging"
            echo "  --kill-zombies     Kill any lingering Python processes holding GPU VRAM"
            echo "  --qwen             Use local Qwen3.5-35B PE checkpoint"
            echo "  --no-pe            Run in raw direct prompt mode (no PE)"
            echo "  --ngrok [TOKEN]    Start public ngrok HTTPS tunnel (high-speed live stream)"
            echo "  --cloudflare       Enable Cloudflare HTTPS tunnel (default: enabled)"
            echo "  --no-cloudflare    Disable Cloudflare HTTPS tunnel"
            echo "  --pinggy           Start public Pinggy tunnel"
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
export JOYOMNI_LOW_VRAM="${JOYOMNI_LOW_VRAM:-1}"
export JOYOMNI_TE_OFFLOAD="${JOYOMNI_TE_OFFLOAD:-1}"
export JOYOMNI_TE_PIN="${JOYOMNI_TE_PIN:-1}"

# Detect local LAN IP address
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP=$(ip -4 addr show scope global 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1)
fi
SERVER_IP=${SERVER_IP:-"127.0.0.1"}

# Check GPU compute capability and FP8 engine
CUDA_CAP=$("$JOY_PYTHON" -c "import torch; print(f'{torch.cuda.get_device_capability()[0]}{torch.cuda.get_device_capability()[1]}' if torch.cuda.is_available() else '0')" 2>/dev/null || echo "0")
FP8_WORKING=0
if "$JOY_PYTHON" -c "import torch, joyomni_ops; dev='cuda:0' if torch.cuda.is_available() else 'cpu'; dt=torch.float8_e4m3fn; a=torch.zeros((1,16),dtype=dt,device=dev); b=torch.zeros((16,16),dtype=dt,device=dev); sa=torch.ones((1,1),dtype=torch.float32,device=dev); sb=torch.ones((1,16),dtype=torch.float32,device=dev); joyomni_ops.fp8_scaled_mm(a,b,sa,sb,torch.bfloat16); exit(0)" 2>/dev/null; then
    FP8_WORKING=1
fi

if [ "$FP8_WORKING" = "1" ]; then
    export JOYOMNI_FP8_IMG=1
    export JOYOMNI_FP8_TXT=1
    export JOYOMNI_FP8_FAST_ACCUM=0
    FP8_STATUS="Enabled (CUTLASS FP8 GEMM)"
elif [ "$CUDA_CAP" = "89" ]; then
    # On SM89 (NVIDIA L40S / RTX 4090): use Triton Fast-Accum FP8 for high speed and light memory footprint (~18GB VRAM)
    export JOYOMNI_FP8_IMG=1
    export JOYOMNI_FP8_TXT=1
    export JOYOMNI_FP8_FAST_ACCUM=1
    FP8_STATUS="Enabled (Triton Fast-Accum FP8 for SM89 / L40S ~18GB VRAM)"
else
    # Fallback to BF16
    export JOYOMNI_FP8_IMG=0
    export JOYOMNI_FP8_TXT=0
    export JOYOMNI_FP8_FAST_ACCUM=0
    FP8_STATUS="BF16 Native Mode"
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

# Free port and kill any orphaned streaming server processes
fuser -k "$PORT/tcp" 2>/dev/null || true
pkill -f "serve_joyomni_streaming.py" 2>/dev/null || true

if [ "${KILL_ZOMBIES:-0}" = "1" ]; then
    echo "[!] Killing zombie GPU processes on device $GPU_ID..."
    fuser -k -9 "/dev/nvidia$GPU_ID" 2>/dev/null || true
    sleep 1
fi

# Check GPU VRAM status and report any external processes
OCCUPIED_GPU_PROCS=""
if command -v nvidia-smi &>/dev/null; then
    OCCUPIED_GPU_PROCS=$(nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader 2>/dev/null || true)
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
echo "[+] Low VRAM Mode: $JOYOMNI_LOW_VRAM (progressive FP8 staging)"
if [ -n "$OCCUPIED_GPU_PROCS" ]; then
    echo "[!] Active GPU Compute Processes Detected:"
    echo "$OCCUPIED_GPU_PROCS" | sed 's/^/    /'
fi
echo ""
echo "=========================================================="
echo "          🌐 HOW TO OPEN IN YOUR BROWSER:                 "
echo "=========================================================="
echo "  1. Direct LAN URL (Fastest & No ISP blocks):"
echo "     👉 http://$SERVER_IP:$PORT/"
echo ""
echo "  2. From your PC/Laptop via SSH Tunnel:"
echo "     Run this on your computer's terminal/cmd:"
echo "     ssh -L $PORT:localhost:$PORT administrator@$SERVER_IP"
echo "     Then open in your browser:"
echo "     👉 http://localhost:$PORT/"
echo ""
echo "  3. Public HTTPS URLs (Mobile & PC):"
echo "     👉 Automatic HTTPS tunnels starting inside application..."
echo "=========================================================="

EXTRA_ARGS="--kv-reset-frames 0 --session-close-timeout-s 20.0 --max-inflight-chunks 2 --profile-timings"
if [ -n "$API_KEY" ]; then
    EXTRA_ARGS="$EXTRA_ARGS --api-key $API_KEY"
fi
if [ "$JOYOMNI_PE_BACKEND" = "api" ] && [ -z "${OPENAI_API_KEY:-}" ]; then
    EXTRA_ARGS="$EXTRA_ARGS --no-use-pe"
fi

if [ "$ENABLE_NGROK" = "1" ]; then
    EXTRA_ARGS="$EXTRA_ARGS --ngrok"
    if [ -n "$NGROK_AUTHTOKEN" ]; then
        EXTRA_ARGS="$EXTRA_ARGS --ngrok-authtoken $NGROK_AUTHTOKEN"
    fi
else
    EXTRA_ARGS="$EXTRA_ARGS --cloudflare --pinggy"
fi

bash "$REPO_ROOT/deploy/run_server.sh" $EXTRA_ARGS
