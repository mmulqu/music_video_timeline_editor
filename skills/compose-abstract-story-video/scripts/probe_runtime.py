#!/usr/bin/env python3
"""Probe the local abstract-story video runtime without changing state."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


def fetch_json(url: str, timeout: float = 10.0):
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.load(response)


def command_version(name: str) -> dict:
    path = shutil.which(name)
    result = {"available": bool(path), "path": path, "version": None}
    if not path:
        return result
    completed = subprocess.run(
        [path, "-version"],
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )
    first_line = (completed.stdout or completed.stderr).splitlines()
    result["version"] = first_line[0] if first_line else None
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--comfy-url", default="http://127.0.0.1:8000")
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()

    report = {
        "comfy_url": args.comfy_url.rstrip("/"),
        "comfyui": {"reachable": False},
        "tools": {
            "ffmpeg": command_version("ffmpeg"),
            "ffprobe": command_version("ffprobe"),
        },
        "required_nodes": {},
        "optional_nodes": {},
        "models": {},
        "errors": [],
    }

    base = report["comfy_url"]
    try:
        stats = fetch_json(f"{base}/system_stats")
        report["comfyui"] = {
            "reachable": True,
            "version": stats.get("system", {}).get("comfyui_version"),
            "python_version": stats.get("system", {}).get("python_version"),
            "argv": stats.get("system", {}).get("argv", []),
            "devices": stats.get("devices", []),
        }
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
        report["errors"].append(f"ComfyUI unavailable: {exc}")

    if report["comfyui"]["reachable"]:
        for node in ("HuggingFaceMusicGen",):
            try:
                info = fetch_json(f"{base}/object_info/{node}")
                report["required_nodes"][node] = bool(info.get(node))
            except (OSError, urllib.error.URLError, json.JSONDecodeError):
                report["required_nodes"][node] = False

        for node in (
            "VHS_VideoCombine",
            "RepeatImageBatch",
            "UnetLoaderGGUF",
            "CLIPLoaderGGUF",
            "CheckpointLoaderSimple",
        ):
            try:
                info = fetch_json(f"{base}/object_info/{node}")
                report["optional_nodes"][node] = bool(info.get(node))
            except (OSError, urllib.error.URLError, json.JSONDecodeError):
                report["optional_nodes"][node] = False

        for model_type in ("checkpoints", "diffusion_models"):
            try:
                report["models"][model_type] = fetch_json(
                    f"{base}/models/{model_type}"
                )
            except (OSError, urllib.error.URLError, json.JSONDecodeError):
                report["models"][model_type] = []

    required_ok = (
        report["comfyui"]["reachable"]
        and report["tools"]["ffmpeg"]["available"]
        and report["tools"]["ffprobe"]["available"]
        and all(report["required_nodes"].values())
    )
    report["ready"] = required_ok

    rendered = json.dumps(report, indent=2)
    print(rendered)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(rendered + "\n", encoding="utf-8")
    return 0 if required_ok else 1


if __name__ == "__main__":
    sys.exit(main())
