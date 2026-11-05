import os
import sys
import argparse
import urllib.request
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
CKPT_DIR = REPO_ROOT / "deploy" / "deps" / "checkpoints"


def download_file_with_progress(url: str, output_path: Path):
    if output_path.exists() and output_path.stat().st_size > 0:
        print(f"[✓] Already downloaded: {output_path.name}")
        return

    print(f"[+] Downloading: {url} -> {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    temp_path = output_path.with_suffix(output_path.suffix + ".tmp")
    try:
        def reporthook(block_num, block_size, total_size):
            downloaded = block_num * block_size
            if total_size > 0:
                percent = min(100.0, downloaded * 100.0 / total_size)
                mb_down = downloaded / (1024 * 1024)
                mb_total = total_size / (1024 * 1024)
                sys.stdout.write(f"\r    -> {mb_down:.1f} MB / {mb_total:.1f} MB ({percent:.1f}%)")
            else:
                mb_down = downloaded / (1024 * 1024)
                sys.stdout.write(f"\r    -> {mb_down:.1f} MB downloaded")
            sys.stdout.flush()

        urllib.request.urlretrieve(url, str(temp_path), reporthook=reporthook)
        print("")
        shutil.move(str(temp_path), str(output_path))
        print(f"[✓] Saved {output_path.name}")
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        print(f"[!] Failed to download {url}: {e}")
        raise e


def download_core_weights(download_qwen: bool = False):
    from huggingface_hub import snapshot_download

    CKPT_DIR.mkdir(parents=True, exist_ok=True)

    print("==========================================================")
    print("      JoyAI-Video-Edit Model Weights Downloader           ")
    print("==========================================================")
    print(f"Target directory: {CKPT_DIR}")

    # 1. DiT and xVAE from jdopensource/JoyAI-Video-Edit
    print("\n[1/4] Downloading DiT & xVAE (jdopensource/JoyAI-Video-Edit)...")
    dit_dir = CKPT_DIR / "JoyAI-Video-Edit"
    dit_dir.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id="jdopensource/JoyAI-Video-Edit",
        local_dir=str(dit_dir),
        allow_patterns=[
            "dit/joyai_video_edit_dit_1101_face++.pth",
            "vae/*",
            "config.json",
        ],
        local_dir_use_symlinks=False,
    )
    print("[✓] DiT & xVAE ready.")

    # 2. Text/Vision Encoder from XiaomiMiMo/MiMo-VL-7B-RL-2508
    print("\n[2/4] Downloading Vision/Text Encoder (XiaomiMiMo/MiMo-VL-7B-RL-2508)...")
    te_dir = CKPT_DIR / "MiMo-VL-7B-RL-2508"
    te_dir.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id="XiaomiMiMo/MiMo-VL-7B-RL-2508",
        local_dir=str(te_dir),
        local_dir_use_symlinks=False,
    )
    print("[✓] Vision/Text Encoder ready.")

    # 3. Detectors (YuNet face detector + YOLOv8n person detector)
    print("\n[3/4] Downloading & preparing presence detectors (YuNet & YOLOv8n)...")
    yunet_path = CKPT_DIR / "face_detection_yunet_2023mar.onnx"
    yunet_url = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
    download_file_with_progress(yunet_url, yunet_path)

    yolo_path = CKPT_DIR / "yolov8n.onnx"
    if not yolo_path.exists():
        try:
            print("[+] Exporting YOLOv8n at 320x320 for person gate...")
            from ultralytics import YOLO
            yolo_model = YOLO("yolov8n.pt")
            exported = yolo_model.export(format="onnx", imgsz=320, opset=12)
            if os.path.exists(exported):
                shutil.move(exported, str(yolo_path))
                print(f"[✓] YOLOv8n ONNX ready at {yolo_path}")
            if os.path.exists("yolov8n.pt"):
                os.remove("yolov8n.pt")
        except Exception as e:
            print(f"[*] Note: YOLOv8n export skipped ({e}). Person detector is optional.")
    else:
        print("[✓] YOLOv8n ONNX already exists.")

    # 4. Optional Qwen Prompt Enhancer
    if download_qwen:
        print("\n[4/4] Downloading Qwen3.5-35B PE checkpoint (~22.8 GB)...")
        qwen_dir = CKPT_DIR / "Qwen3.5-35B-A3B-GPTQ-Int4"
        qwen_dir.mkdir(parents=True, exist_ok=True)
        snapshot_download(
            repo_id="Qwen/Qwen3.5-35B-A3B-GPTQ-Int4",
            revision="3af5ca2972faf6de1fd6f4efc4d8d319ca751e8b",
            local_dir=str(qwen_dir),
            local_dir_use_symlinks=False,
        )
        print("[✓] Qwen PE checkpoint ready.")
    else:
        print("\n[4/4] Skipping Qwen PE checkpoint (22.8 GB).")
        print("    The server will run in direct/raw prompt mode or external API mode.")
        print("    To download local Qwen later, run: python download_weights.py --qwen")

    print("\n==========================================================")
    print("      All required model weights downloaded successfully!  ")
    print("==========================================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download JoyAI-Video-Edit weights")
    parser.add_argument("--qwen", action="store_true", help="Download optional Qwen3.5-35B INT4 PE checkpoint (22.8 GB)")
    args = parser.parse_args()

    download_core_weights(download_qwen=args.qwen)
