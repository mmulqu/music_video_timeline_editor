---
name: compose-abstract-story-video
description: Design, generate, assemble, and inspect abstract narrative videos made from supplied or AI-generated still images and music, including lyric-captioned music videos. Use when Codex needs to turn a theme, history, argument, transformation, speculative story, song, or numbered image sequence into a reviewable treatment, shot manifest, ComfyUI storyboard, MusicGen score, lyric timing map, FFmpeg timeline, draft video, final render, or technical QA report.
---

# Compose Abstract Story Video

Create picture-led abstract stories in which recurring visual state carries
meaning and instrumental music carries energy. Work from a versioned manifest,
stop at creative review gates, preserve supplied originals, and regenerate only
rejected or missing generated assets.

## Read the relevant references

- Read [references/auspex-runtime.md](references/auspex-runtime.md) when using the
  local Auspex, ComfyUI, MusicGen, or FFmpeg installation.
- Read [references/manifest-schema.md](references/manifest-schema.md) before
  creating or modifying a project manifest.
- Read
  [references/abstract-narrative-language.md](references/abstract-narrative-language.md)
  when developing the treatment, act structure, motif ledger, palette ledger,
  or image prompts.
- Read
  [references/editing-supplied-images.md](references/editing-supplied-images.md)
  when the user provides an existing numbered image sequence or asks for an
  edit without image generation.
- Read
  [references/timeline-rendering.md](references/timeline-rendering.md)
  when rendering an existing timeline editor JSON, mixed still/GIF/video media,
  lyric captions, a locked supplied song, or a revision of an approved master.

## Choose the execution path

- For a new story, begin with treatment and storyboard review.
- For supplied images, inventory and inspect the originals before assigning
  timing, motion, or transitions. Treat the user-provided order as intentional
  unless visual evidence or the user says otherwise.
- For an existing manifest, validate it and resume from its recorded status.
- For image-only iteration, generate model-comparison frames and a contact sheet.
- For music-only iteration, generate 30-second MusicGen movements and an
  overlapped preview.
- For assembly, use FFmpeg from approved assets; do not regenerate them.
- For a final render, require an approved draft unless the user explicitly asks
  to skip review.

## Use tools by responsibility

### ComfyUI

Use the local ComfyUI API for still-image and MusicGen asset generation. Record
the exact prompt, negative prompt, seed, model, sampler, dimensions, and output
path. Prefer local `127.0.0.1` access during development.

Do not force a long-form story into the short Auspex `/run/oracle` endpoint. It
is designed for one image and 4-30 seconds of audio.

Discover completed ComfyUI outputs recursively under the configured output
directory and match both filename prefix and creation time. Nodes may place
audio beneath nested folders such as `output/audio`; do not assume a flat output
directory.

### FFmpeg and ffprobe

Treat FFmpeg and ffprobe as first-class dependencies:

- Probe exact dimensions, frame rates, codecs, durations, sample rates, and
  channel layouts with ffprobe.
- Map video and audio streams explicitly. A music file may contain album art or
  another attached video stream; never rely on FFmpeg's automatic mapping.
- Build slow still motion with `zoompan` or equivalent deterministic filters.
- Join shots with `xfade`; use hard cuts where the manifest requests them.
- For reliable `xfade`, first render every still-motion shot as a real
  constant-frame-rate intermediate. Apply `fps`, `settb`, and `setpts`, then
  probe the clip before joining. Raw looped still inputs may expose an invalid
  or `1/0` rate even when a filter appears to set the frame rate.
- Join MusicGen movements with equal-power `acrossfade`.
- Inspect loudness, silence, and clipping with `loudnorm`, `ebur128`,
  `silencedetect`, and `astats`.
- Render a low-resolution proxy before the final master.
- Prefer NVENC for fast previews when available. Prefer portable H.264/x264 for
  the default final unless the user selects another delivery codec.
- After motion and final effects, explicitly set square pixels and a portable
  delivery format such as `setsar=1,format=yuv420p`; verify SAR, DAR, pixel
  format, and color range with ffprobe instead of judging appearance alone.

Generate filter graphs from the manifest. Do not hand-edit a complex command
without writing the resolved command and timing data into the run report.

### Locked supplied soundtrack

When the user supplies a finished song, designate it as the locked canonical
soundtrack. The song defines timeline zero, musical events, and final duration;
fit images, cuts, motion, captions, and effects around it.

Do not trim, splice, loop, reorder, time-stretch, pitch-shift, crossfade, fade,
duck, normalize, remaster, stem-separate/recombine, or otherwise process the
canonical audio unless the user explicitly requests an audio edit. Do not cut
and paste song excerpts to fit visual edits. Preserve the source file and record
its hash and probed stream properties before assembly.

Render the video track to the soundtrack's full probed duration, then mux the
untouched audio with stream copy (`-c:a copy`) when the delivery container
supports its codec. Choose a compatible container rather than silently
transcoding. If a delivery requirement forces audio re-encoding, keep an
audio-preserving master, create the compatibility encode as a separate
derivative only with user approval, and disclose it. Verify the delivered
master by comparing the source and muxed audio packet/bitstream hashes plus
duration, codec, sample rate, and channel layout.

### Experimental vocal repairs

Attempt a pronunciation repair only with explicit authorization. Preserve the
canonical song, work on a derivative, and patch the smallest feasible word or
phoneme: locate it with timestamps, isolate a short vocal/instrumental region,
generate multiple voice-clone takes, then match timing, pitch, gain, ambience,
and boundary fades. Provide a local original-versus-repair A/B before applying
the edit to a full-track derivative.

Treat this method as experimental. In testing, a Qwen voice-cloned word became
intelligible and passed transcription checks, but did **not** make a fluid,
convincing repair in the sung mix. Never equate correct transcription, clean
splices, or matched loudness with perceptual success. Require human listening
approval; retain the failed takes and prefer source stems, a singer re-recording,
or regeneration when the inserted word remains audible as an edit.

### Python

Use Python for API orchestration, manifest validation, deterministic file naming,
resume logic, contact-sheet labels, FFmpeg command construction, and QA reports.
Keep creative decisions in the manifest rather than hardcoding them in scripts.

### Lyric timestamps

When exact lyrics are supplied, treat them as canonical and use transcription
only to locate acoustic anchors. For the OpenAI transcription API, verify current
model capabilities; `whisper-1` presently returns structured word and segment
timestamps with `response_format=verbose_json` and
`timestamp_granularities=["word", "segment"]`. Models optimized for transcript
accuracy may be useful as a text audit but do not necessarily return timestamps.

Transcribe the final mix first. Optionally compare a vocal stem, but do not assume
source separation improves recognition. Align canonical lyric tokens to the
timed transcript, retain segment boundaries as fallback anchors, and manually
inspect fast, screamed, overlapped, repeated, or sparsely recognized passages.
Repair zero-duration or implausible word spans before caption rendering. Preserve
the raw API JSON, aligned lyric map, and reviewable SRT/ASS as separate artifacts.

### Optional tools

Use Pillow or ImageMagick for contact sheets when available. Use optional audio
or video inspection utilities only when they improve a defined check. Probe
optional tools and degrade cleanly; never silently substitute unrelated image or
music generators.

## Workflow

### 1. Probe the runtime

Run:

```powershell
python scripts/probe_runtime.py --comfy-url http://127.0.0.1:8000
```

Confirm the tools required by the selected path. Supplied-image edits require
FFmpeg and ffprobe; ComfyUI, MusicGen, GPU models, and output paths are required
only for assets being generated. Report missing requirements before generation.

When working in Auspex repositories, inspect local instructions and dirty
worktrees. Preserve uncommitted changes and never read or copy `.env` secrets
into project artifacts.

### 2. Write the treatment

Define:

- premise and unresolved question
- target duration and aspect ratio
- 4-8 acts
- persistent motif
- geometry, material, palette, and density progressions
- musical energy arc
- ending state
- literal imagery to exclude

Prefer transformation over illustration. A recurring form must change state
across the story so the sequence reads as causally related.

### 3. Create the manifest

Copy `assets/story-manifest.template.json` into a new run directory and fill it
with the approved treatment, shots, music movements, transitions, and render
settings.

Set `source_type` to `generated` or `supplied` per shot. For supplied assets,
record the untouched original in `source_path`, use `asset_path` for the frozen
run copy or normalized derivative, and set the image backend to
`supplied-assets`.

Validate it:

```powershell
python scripts/validate_manifest.py path\to\manifest.json
```

Use deterministic seeds and stable asset names. Keep generation status and human
approval status separate.

### 4. Generate the storyboard

For generated imagery, generate only the comparison frames first:

- one quiet/low-density act
- one peak/high-density act
- each with the candidate image backends

After selecting a backend, generate the remaining low-cost storyboard images.
Create a labeled contact sheet showing shot ID, act, seed, and duration.

Stop for storyboard review. Do not infer approval from successful generation.

For supplied imagery, make a natural-number-sorted inventory and contact sheet,
inspect every source at readable scale, and probe its dimensions and
orientation. Freeze copies inside the run when practical. Do not overwrite or
silently crop the originals.

### 5. Generate the music

MusicGen is limited to 30 seconds locally. Treat each generation as a movement:

- include `instrumental, no vocals, no spoken word, no choir`
- use a shared sonic vocabulary across movements
- vary density, tempo, register, and texture by act
- keep raw generations
- crossfade movements rather than looping a single clip

The installed node accepts optional conditioning audio. Test continuity from the
previous movement's tail only as an opt-in mode; prompt continuity plus FFmpeg
crossfades is the baseline.

Create a numbered movement preview and stop for listening review.

After assembly, measure the score and the encoded master independently.
Normalization before AAC encoding is not proof of final loudness or true peak;
verify the delivered file with `ebur128` and recalibrate if needed.

### 6. Assemble the draft

Resolve final shot timing against musical events. For a locked supplied song,
never resolve timing by changing the song. Generate:

- a timeline report
- the exact FFmpeg command or filter script
- a 960x540 review proxy
- a draft QA report

For an editor-authored timeline, snapshot and hash the exact JSON before
rendering. Reproduce the editor's documented selection rule for overlapping
visuals, then resolve it into frame-quantized visible segments. Do not assume
that array order, caption linkage, or a long underlying beat makes overlaps
irrelevant. Detect uncovered frames; never introduce black by accident.

Treat GIFs and videos as time-based media. Loop GIFs only when the manifest says
to, and honor video source-in, source-out, and playback rate. For a segment cut
from the middle of a visual, advance the source position by the elapsed timeline
time multiplied by playback rate.

Keep motion restrained unless the treatment requires rupture. Use the shortest
holds and hardest cuts at the narrative peak, then restore duration and space.
Vary motion direction and magnitude from the image composition; uniform
Ken-Burns motion makes a sequence feel mechanical. Resolve whether shot
durations mean source-clip length or visible timeline length, because transition
overlaps can otherwise shorten the film.

### 7. Render and inspect

After draft approval, render the final from the same approved assets. Verify:

- expected total duration within one video frame
- output resolution and frame rate
- playable audio and video streams
- no unintended silence or clipping
- normalized integrated loudness for generated scores; measurement only for a
  locked supplied song
- locked supplied soundtrack preserved without trimming, processing, or
  re-encoding, verified against the source stream
- no missing or duplicated shots
- GIFs and videos visibly change across two interior sample frames; keep QA
  samples at least 2-3 frames away from edit boundaries
- square-pixel output with expected display aspect ratio, portable pixel format,
  and intentional color range
- no unintended black intervals; distinguish a deliberate final blackout from
  a missing visual
- no unexpected vocal-like MusicGen output by human listening review
- manifest, report, and asset paths are complete

Inspect the full-film contact sheet plus full-resolution frames at the quietest
state, narrative peak, consequence, and ending. When the ending depends on
motion, compare its entry frame with its last frame; a nominal 1-2% pull may be
visually imperceptible.

## Review gates

Stop at:

1. treatment
2. storyboard contact sheet
3. music movement preview
4. low-resolution complete draft
5. final QA

If the user asks for autonomous generation, continue through technical stages
but still preserve each review artifact so decisions can be revised cheaply.

## Run layout

Use:

```text
runs/<project-id>/
├── manifest.json
├── treatment.md
├── source/
├── storyboard/
├── music/
├── previews/
├── renders/
└── reports/
```

Never overwrite an approved asset. Create a new revision and update the manifest.
