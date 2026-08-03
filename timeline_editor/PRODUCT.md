# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The creator of a fast-cut music video, working locally with a supplied song,
canonical lyrics, and a growing folder of visual assets.

## Product Purpose

Correct caption timing and attach stills or video beats to a song without
altering the supplied music. Success is a saved timeline manifest that can be
assembled deterministically into the next video revision.

## Positioning

An editing desk that treats canonical lyrics as truth and transcription as
timing evidence, while preserving the original song as a locked soundtrack.

## Operating Context

Runs locally in a browser from a music-video project repository. The user plays
the song, adjusts cue boundaries at the playhead, imports local visual files,
and saves a project-relative JSON manifest for FFmpeg assembly.

## Capabilities and Constraints

- Edit caption text, start, and end times.
- Show uncaptioned visual intervals as first-class, blank-lyric rows in the
  chronological cue sheet, where they can be sought, retimed, replaced, or
  removed without inventing a caption association. An explicitly selected VIS
  row remains selected while its interval is active, even if a lyric overlaps.
- Add, retime, and associate still-image, animated-GIF, or video visual cues.
- Replace the visual under the playhead without changing its timeline In/Out.
  Adding another visual is a separate explicit mode that evenly divides the
  cue's existing visual coverage without changing its outer or caption timing.
- Remove a visual through an explicit Remove & merge action. Give its interval
  to the previous visual, or to the next visual when removing the first beat,
  without moving caption or soundtrack timing.
- Load a local music file, fingerprint it, and preview the synchronized edit.
- Slow preview playback to a preset or custom rate for manual timing while
  preserving the soundtrack file and timeline timecodes unchanged.
- Switch the waveform transport clock between `MM:SS.mmm` and total decimal
  seconds so playhead values can be read directly in the same units used by
  editable In/Out fields. This is a display preference only.
- Ripple edited In/Out boundaries across adjacent visual beats by default so
  retiming cannot silently create black frames. Couple nearby lyric boundaries
  while preserving longer intentional lyric pauses and visual-only passages;
  allow ripple to be disabled for deliberate gaps or overlaps.
- Follow and scroll to the active caption during playback.
- Import project folders or individual local media files as session assets.
- Discover newly added files from the project `images` folder on demand and
  periodically while the Library is open.
- Save and reopen a `music-video-timeline/v1` JSON manifest.
- The supplied song is immutable: no trim, splice, processing, or re-encode.

## Project Inputs

- a finished local soundtrack
- canonical lyrics or an existing caption timeline
- project-relative still images, animated GIFs, or videos
- optional transcription timing evidence

## Product Principles

- Let the song define the timeline; fit all visual work around it.
- Make correction at the playhead faster than typing a timecode.
- Preserve canonical copy and raw timing evidence separately.
- Save plain, inspectable, project-relative data.

## Accessibility & Inclusion

Support keyboard playback and cue-boundary controls, visible focus states, and
high-contrast controls.
