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
- Add, retime, and associate still-image, animated-GIF, or video visual cues.
- Replace the visual under the playhead without changing its timeline In/Out;
  adding another beat is a separate explicit mode.
- Load a local music file, fingerprint it, and preview the synchronized edit.
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
