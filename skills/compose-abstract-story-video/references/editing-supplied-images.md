# Editing supplied image sequences

Use this path when the user supplies an ordered image folder and wants music and
editing rather than new still-image generation.

## Preserve and inventory

- Treat natural numeric filename order as story order unless instructed
  otherwise: `2` follows `1`, not `19`.
- Probe dimensions, format, orientation, alpha, and readability.
- Build a labeled contact sheet and inspect every image before timing the edit.
- Detect obvious duplicates or unreadable files.
- Preserve originals. Freeze copies in `runs/<project-id>/source/` when practical
  and record each original as `source_path`.

## Convert images into shots

- Use the user's story ranges as act boundaries, then confirm them visually.
- Let content determine pacing. For a short film, use roughly 1.5-3 seconds at
  high tension and 3-5 seconds for awe, grief, or the final image.
- Use hard cuts for rupture, conflict, and scale discontinuity. Use short
  dissolves for learning, reconstruction, ecological growth, and elegy.
- Protect focal subjects when adapting mixed aspect ratios. Use a deliberate
  crop anchor or background treatment instead of a blind center crop.
- Choose motion from composition: push toward discoveries, pan with directional
  forces, and pull away for aftermath or irresolution. Vary direction and
  magnitude; reserve obvious motion for turning points.

## Build a reliable FFmpeg timeline

Render every still-motion shot to its own constant-frame-rate intermediate
before joining:

1. normalize scale, crop, and pixel format
2. apply `zoompan` or deterministic pan/zoom
3. apply `fps`, `settb`, and `setpts`
4. encode the exact intended clip duration
5. probe frame rate and duration
6. join intermediates with `xfade` or hard cuts

This two-stage approach prevents still inputs with undefined frame rates from
breaking `xfade` and makes resume behavior cheap. Write the resolved commands
and transition offsets to the run report.

Define timing semantics explicitly. If manifest shot durations are visible
timeline durations, account for transition overlap when rendering source clips.
Always probe the assembled film and trim or pad only after verifying the
narrative end frame is preserved.

## Score short films

For a target duration under one minute, two contrasting MusicGen movements are
often enough. Choose movement lengths and crossfade so:

`sum(movement durations) - crossfade overlap = target duration`

Share instrumentation and a small motif between movements. Put the main
discontinuity near the story's irreversible turn; let the final movement
transform earlier material rather than merely become quieter.

## Review

- Inspect a full-film contact sheet.
- Inspect full-resolution frames at the opening, peak, consequence, recovery,
  and final state.
- Compare entry and last frames when ending motion carries meaning.
- Measure final encoded loudness and true peak, scan for long silence, and
  perform a full decode check.
