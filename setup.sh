#!/bin/bash
# ==========================================================
#     JoyAI-Video-Edit Automated Setup for Ubuntu Server
# ==========================================================

set -euo pipefail

# Prevent global user-site packages (~/.local) from polluting the isolated conda env
export PYTHONNOUSERSITE=1

echo "=========================================================="
echo "    JoyAI-Video-Edit Automated Installation (Ubuntu)      "
echo "=========================================================="

# 1. System prerequisites
echo ""
echo "[1/6] Installing system dependencies (OpenGL, GLib, ffmpeg, ninja, build tools)..."
sudo apt-get update -qq 2>/dev/null || true
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    wget \
    curl \
    git \
    ffmpeg \
    ninja-build 2>/dev/null || true

# 2. Locate or Install Miniconda
echo ""
echo "[2/6] Detecting Conda installation..."
CONDA_EXEC=""
for c_bin in "$HOME/miniconda3/bin/conda" "$HOME/anaconda3/bin/conda" "/opt/conda/bin/conda" "$HOME/miniconda/bin/conda" "$HOME/miniforge3/bin/conda"; do
    if [ -f "$c_bin" ]; then
        CONDA_EXEC="$c_bin"
        break
    fi
done

if [ -z "$CONDA_EXEC" ] && command -v conda &>/dev/null; then
    CONDA_EXEC=$(command -v conda)
fi

if [ -z "$CONDA_EXEC" ]; then
    echo "[+] Conda not found. Installing Miniconda3 into $HOME/miniconda3..."
    wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh
    bash /tmp/miniconda.sh -b -p "$HOME/miniconda3"
    rm -f /tmp/miniconda.sh
    CONDA_EXEC="$HOME/miniconda3/bin/conda"
fi

# Source conda environment scripts
CONDA_DIR=$(dirname $(dirname "$CONDA_EXEC"))
if [ -f "$CONDA_DIR/etc/profile.d/conda.sh" ]; then
    source "$CONDA_DIR/etc/profile.d/conda.sh"
fi

# Automatically accept Anaconda Terms of Service to prevent CondaToSNonInteractiveError
"$CONDA_EXEC" tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main 2>/dev/null || true

# 3. Create or Update Conda Environment with Python 3.10
echo ""
echo "[3/6] Setting up 'joyai-video-edit' environment (Python 3.10)..."
if "$CONDA_EXEC" info --envs | grep -q "^joyai-video-edit "; then
    echo "[+] Existing 'joyai-video-edit' environment found."
else
    echo "[+] Creating 'joyai-video-edit' environment with Python 3.10..."
    "$CONDA_EXEC" create -y -n joyai-video-edit python=3.10 -c conda-forge
fi

# Resolve Python binary inside joyai-video-edit environment
JOY_PYTHON="$CONDA_DIR/envs/joyai-video-edit/bin/python"
if [ ! -f "$JOY_PYTHON" ]; then
    JOY_PYTHON=$(find "$HOME/miniconda3/envs/joyai-video-edit" "$HOME/anaconda3/envs/joyai-video-edit" "/opt/conda/envs/joyai-video-edit" -name python -type f 2>/dev/null | head -n 1)
fi

if [ ! -f "$JOY_PYTHON" ]; then
    echo "[!] Error: Could not locate Python binary in 'joyai-video-edit' conda environment!"
    exit 1
fi
echo "[+] Using Python binary: $JOY_PYTHON"

# Ensure pip is up to date
"$JOY_PYTHON" -m pip install --upgrade pip setuptools wheel

# 4. Install PyTorch and Python Dependencies
echo ""
echo "[4/6] Installing PyTorch 2.9.1 (CUDA 12.8) and pinned requirements..."
"$JOY_PYTHON" -m pip install -r deploy/requirements.txt
"$JOY_PYTHON" -m pip install huggingface_hub onnx onnxslim ultralytics

# 5. Build joyomni_ops CUDA extension
echo ""
echo "[5/6] Building in-tree CUDA extension (joyomni_ops)..."
mkdir -p deploy/tmp
if [ ! -d "deploy/tmp/cutlass" ]; then
    echo "[+] Cloning CUTLASS for FP8 GEMM kernels..."
    git clone https://github.com/NVIDIA/cutlass.git deploy/tmp/cutlass 2>/dev/null || true
    if [ -d "deploy/tmp/cutlass" ]; then
        git -C deploy/tmp/cutlass checkout dcf215af 2>/dev/null || true
    fi
fi

# Determine CUDA arch for local GPU
CUDA_ARCH=$("$JOY_PYTHON" -c "import torch; cc = torch.cuda.get_device_capability(0) if torch.cuda.is_available() else (8, 9); print(f'{cc[0]}{cc[1]}a' if cc[0] >= 9 else f'{cc[0]}{cc[1]}')" 2>/dev/null || echo "89")
echo "[+] Detected GPU Compute Capability: sm_$CUDA_ARCH"

export JOYOMNI_OPS_CUDA_ARCHS="$CUDA_ARCH"
BUILD_SUCCESS=0

if [ -d "deploy/tmp/cutlass" ]; then
    echo "[+] Attempting FP8 CUTLASS build for joyomni_ops..."
    if JOYOMNI_OPS_CUTLASS_DIR="$(pwd)/deploy/tmp/cutlass" "$JOY_PYTHON" -m pip install --no-build-isolation ./deploy/joyomni_ops; then
        BUILD_SUCCESS=1
        echo "[✓] Built joyomni_ops with FP8 GEMM support!"
    fi
fi

if [ $BUILD_SUCCESS -eq 0 ]; then
    echo "[*] Building light joyomni_ops variant (bf16 kernels)..."
    JOYOMNI_OPS_NO_FP8=1 "$JOY_PYTHON" -m pip install --no-build-isolation ./deploy/joyomni_ops || {
        echo "[!] Warning: joyomni_ops build failed. Server will use standard PyTorch fallback."
    }
fi

# 6. Download Model Checkpoints
echo ""
echo "[6/6] Downloading model checkpoints..."
QWEN_FLAG=""
if [[ "${1:-}" == "--qwen" ]]; then
    QWEN_FLAG="--qwen"
fi
"$JOY_PYTHON" download_weights.py $QWEN_FLAG

# Verification
echo ""
echo "=========================================================="
echo "                   Verifying Installation                 "
echo "=========================================================="
"$JOY_PYTHON" -c "
import torch
print(f'PyTorch Version: {torch.__version__}')
print(f'CUDA Available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'Active GPU: {torch.cuda.get_device_name(0)}')
try:
    import joyomni_ops
    print(f'joyomni_ops: OK (has_fp8={joyomni_ops.has_fp8()})')
except Exception as e:
    print(f'joyomni_ops: Not loaded ({e}) - bf16 mode will be used')
import transformers, diffusers, fastapi
print('Core libraries verified successfully!')
"

echo ""
echo "=========================================================="
echo "    JoyAI-Video-Edit Setup Completed Successfully!        "
echo "=========================================================="
echo ""
echo "To start the streaming video edit server, run:"
echo "    bash run.sh"
echo ""
echo "Or with custom options:"
echo "    bash run.sh --port 8090 --gpu 0"
echo "=========================================================="

