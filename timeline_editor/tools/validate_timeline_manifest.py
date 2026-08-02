#!/usr/bin/env python3
"""Validate a music-video-timeline/v1 file before FFmpeg assembly."""

from __future__ import annotations

import json
import hashlib
import subprocess
import sys
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[2]


def fail(message: str) -> None:
    print(f"ERROR: {message}")
    raise SystemExit(1)


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: validate_timeline_manifest.py <timeline.json>")
    path = Path(sys.argv[1]).resolve()
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schema") != "music-video-timeline/v1":
        fail("unsupported or missing schema")
    soundtrack = payload.get("soundtrack", {})
    if not soundtrack.get("locked") or soundtrack.get("audio_policy") != "stream-copy-only":
        fail("soundtrack must remain locked with stream-copy-only policy")
    duration = float(soundtrack.get("duration_seconds", 0))
    if duration <= 0:
        fail("soundtrack duration must be positive")
    soundtrack_path = (PROJECT / soundtrack.get("relative_path", "")).resolve()
    if PROJECT.resolve() not in soundtrack_path.parents or not soundtrack_path.is_file():
        fail("soundtrack path is missing or outside the project")
    expected_hash = soundtrack.get("sha256", "")
    actual_hash = hashlib.sha256(soundtrack_path.read_bytes()).hexdigest()
    if not expected_hash or actual_hash.lower() != expected_hash.lower():
        fail("soundtrack fingerprint differs from the locked source")
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(soundtrack_path)],
        check=True, capture_output=True, text=True,
    )
    probed_duration = float(probe.stdout.strip())
    if abs(probed_duration - duration) > 0.05:
        fail(f"soundtrack duration differs from manifest ({probed_duration:.3f}s vs {duration:.3f}s)")
    captions = payload.get("captions", [])
    assets = {asset.get("id"): asset for asset in payload.get("assets", [])}
    for asset in assets.values():
        asset_type = asset.get("type")
        if asset_type not in {"image", "gif", "video"}:
            fail(f"{asset.get('id', 'asset')} has unsupported media type {asset_type!r}")
        if Path(asset.get("relative_path", asset.get("name", ""))).suffix.lower() == ".gif":
            if asset_type != "gif" or asset.get("animation_policy") != "loop_to_timeline":
                fail(f"{asset.get('id', 'asset')} must identify GIF loop behavior")
    caption_ids = {caption.get("id") for caption in captions}
    previous_start = -1.0
    for cue in captions:
        start, end = float(cue["start"]), float(cue["end"])
        if not cue.get("text", "").strip():
            fail(f"{cue.get('id', 'caption')} has no text")
        if not (0 <= start < end <= duration + 0.001):
            fail(f"{cue.get('id', 'caption')} has invalid timing {start:.3f}–{end:.3f}")
        if start < previous_start:
            fail(f"{cue.get('id', 'caption')} is out of chronological order")
        previous_start = start
    for visual in payload.get("visuals", []):
        start, end = float(visual["start"]), float(visual["end"])
        if not (0 <= start < end <= duration + 0.001):
            fail(f"{visual.get('id', 'visual')} has invalid timing")
        asset = assets.get(visual.get("asset_id"))
        if asset is None:
            fail(f"{visual.get('id', 'visual')} references a missing asset")
        if not asset.get("relative_path"):
            fail(f"{visual.get('id', 'visual')} references an asset without a project-relative path")
        asset_path = (PROJECT / asset["relative_path"]).resolve()
        if PROJECT.resolve() not in asset_path.parents or not asset_path.is_file():
            fail(f"{visual.get('id', 'visual')} references a missing or out-of-project asset")
        if visual.get("caption_id") is not None and visual.get("caption_id") not in caption_ids:
            fail(f"{visual.get('id', 'visual')} references a missing caption")
        source_in = float(visual.get("source_in", 0) or 0)
        source_out = visual.get("source_out")
        if source_out is not None and float(source_out) <= source_in:
            fail(f"{visual.get('id', 'visual')} has an invalid video source range")
    print(f"Valid: {len(captions)} captions, {len(payload.get('visuals', []))} visuals, duration {duration:.3f}s")


if __name__ == "__main__":
    main()
