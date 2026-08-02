#!/usr/bin/env python3
"""Validate an abstract-story manifest using only the Python standard library."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path


REQUIRED_TOP_LEVEL = {
    "project_id",
    "title",
    "duration_target",
    "resolution",
    "fps",
    "image_backend",
    "music_backend",
    "audio_crossfade_seconds",
    "acts",
    "shots",
    "music_movements",
    "render",
}
REQUIRED_SHOT = {
    "id",
    "act_id",
    "duration",
    "width",
    "height",
    "motion",
    "transition",
    "asset_path",
    "generation_status",
    "approval_status",
}
REQUIRED_GENERATED_SHOT = {"prompt", "negative_prompt", "seed"}
REQUIRED_SUPPLIED_SHOT = {"source_path"}
REQUIRED_MUSIC = {
    "id",
    "act_id",
    "duration",
    "prompt",
    "seed",
    "guidance_scale",
    "temperature",
    "asset_path",
    "generation_status",
    "approval_status",
}


def missing(obj: dict, fields: set[str]) -> list[str]:
    return sorted(fields.difference(obj))


def duplicate_values(items: list[dict], key: str) -> set[str]:
    values = [str(item.get(key, "")) for item in items]
    return {value for value in values if value and values.count(value) > 1}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()

    errors: list[str] = []
    warnings: list[str] = []
    try:
        data = json.loads(args.manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read manifest: {exc}")
        return 1

    for field in missing(data, REQUIRED_TOP_LEVEL):
        errors.append(f"missing top-level field: {field}")

    resolution = data.get("resolution")
    if (
        not isinstance(resolution, list)
        or len(resolution) != 2
        or not all(isinstance(value, int) and value > 0 for value in resolution)
    ):
        errors.append("resolution must contain two positive integers")

    fps = data.get("fps", 0)
    if not isinstance(fps, (int, float)) or fps <= 0:
        errors.append("fps must be positive")

    acts = data.get("acts", [])
    shots = data.get("shots", [])
    music = data.get("music_movements", [])
    if not acts:
        errors.append("acts must not be empty")
    if not shots:
        errors.append("shots must not be empty")
    if not music:
        errors.append("music_movements must not be empty")

    act_ids = {str(act.get("id", "")) for act in acts}
    for collection_name, items in (("shots", shots), ("music_movements", music)):
        duplicates = duplicate_values(items, "id")
        if duplicates:
            errors.append(
                f"duplicate {collection_name} ids: {', '.join(sorted(duplicates))}"
            )

    shot_duration = 0.0
    for index, shot in enumerate(shots):
        label = shot.get("id", f"shots[{index}]")
        for field in missing(shot, REQUIRED_SHOT):
            errors.append(f"{label}: missing field {field}")
        # Manifests created before the supplied-asset workflow are generated.
        source_type = str(shot.get("source_type", "generated"))
        if source_type == "generated":
            for field in missing(shot, REQUIRED_GENERATED_SHOT):
                errors.append(f"{label}: generated shot missing field {field}")
        elif source_type == "supplied":
            for field in missing(shot, REQUIRED_SUPPLIED_SHOT):
                errors.append(f"{label}: supplied shot missing field {field}")
        else:
            errors.append(f"{label}: source_type must be generated or supplied")
        if str(shot.get("act_id", "")) not in act_ids:
            errors.append(f"{label}: unknown act_id {shot.get('act_id')}")
        duration = shot.get("duration", 0)
        if not isinstance(duration, (int, float)) or duration <= 0:
            errors.append(f"{label}: duration must be positive")
        else:
            shot_duration += float(duration)

    music_duration = 0.0
    for index, movement in enumerate(music):
        label = movement.get("id", f"music_movements[{index}]")
        for field in missing(movement, REQUIRED_MUSIC):
            errors.append(f"{label}: missing field {field}")
        if str(movement.get("act_id", "")) not in act_ids:
            errors.append(f"{label}: unknown act_id {movement.get('act_id')}")
        duration = movement.get("duration", 0)
        if not isinstance(duration, (int, float)) or not 1 <= duration <= 30:
            errors.append(f"{label}: local MusicGen duration must be 1-30 seconds")
        else:
            music_duration += float(duration)
        prompt = str(movement.get("prompt", "")).lower()
        if "no vocals" not in prompt or "instrumental" not in prompt:
            errors.append(
                f"{label}: prompt must include both 'instrumental' and 'no vocals'"
            )

    crossfade = data.get("audio_crossfade_seconds", 0)
    if not isinstance(crossfade, (int, float)) or crossfade < 0:
        errors.append("audio_crossfade_seconds must be nonnegative")
        crossfade = 0
    if music and any(
        isinstance(item.get("duration"), (int, float))
        and crossfade >= item["duration"]
        for item in music
    ):
        errors.append("audio crossfade must be shorter than every music movement")

    joined_music_duration = music_duration - max(len(music) - 1, 0) * crossfade
    target = data.get("duration_target", 0)
    frame_tolerance = 1 / fps if isinstance(fps, (int, float)) and fps > 0 else 0
    if isinstance(target, (int, float)) and target > 0:
        if not math.isclose(shot_duration, target, abs_tol=max(frame_tolerance, 0.05)):
            warnings.append(
                f"shot duration {shot_duration:.3f}s differs from target {target:.3f}s"
            )
        if not math.isclose(
            joined_music_duration, target, abs_tol=max(frame_tolerance, 0.05)
        ):
            warnings.append(
                "joined music duration "
                f"{joined_music_duration:.3f}s differs from target {target:.3f}s"
            )

    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")

    print(
        json.dumps(
            {
                "valid": not errors,
                "acts": len(acts),
                "shots": len(shots),
                "music_movements": len(music),
                "shot_duration": round(shot_duration, 3),
                "joined_music_duration": round(joined_music_duration, 3),
                "warnings": len(warnings),
                "errors": len(errors),
            },
            indent=2,
        )
    )
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
