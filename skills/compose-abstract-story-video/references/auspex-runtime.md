# Auspex and ComfyUI local runtime

Read this reference when operating a local Auspex or ComfyUI installation.

## Discover source locations

Do not assume another machine shares the development workstation's paths. Locate
the canonical Auspex repository, runtime/bridge repository, workflow directory,
ComfyUI installation, input directory, and output directory from the current
environment. Prefer explicit command arguments or project-specific environment
variables such as `AUSPEX_ROOT`, `AUSPEX_RUNTIME_ROOT`, and `COMFYUI_ROOT`.

The conventional local ComfyUI URL is `http://127.0.0.1:8000`; probe it before
use and honor an explicitly supplied URL.

Search the ComfyUI output tree recursively for completed assets. Music nodes may
write to nested locations such as `output/audio`; match the requested filename
prefix and a fresh creation timestamp before copying an output into a run.

Some deployments use a bridge-directory `comfy_worker_api.py` shim that loads a
canonical worker while retaining the bridge directory's `.env` and workflows.
Confirm that relationship locally. Do not copy secrets from `.env` files.

Inspect both repositories for `AGENTS.md` and dirty worktrees before edits.

## Existing combined oracle

`oracle_combined.json` currently:

- generates one Z-Image Turbo still
- generates one MusicGen clip
- repeats the still at 1 fps
- combines the repeated image and audio with `VHS_VideoCombine`

Important node IDs:

| ID | Class | Purpose |
|---:|---|---|
| 10 | PrimitiveStringMultiline | image prompt |
| 11 | PrimitiveStringMultiline | audio prompt |
| 13 | EmptySD3LatentImage | image dimensions |
| 67 | SamplerCustom | image seed |
| 150 | RepeatImageBatch | repeated still frames |
| 200 | HuggingFaceMusicGen | instrumental audio |
| 300 | VHS_VideoCombine | MP4 assembly |

The worker's `OracleRequest` and installed MusicGen node cap duration at 30
seconds. The node exposes small, medium, and large models; current workflow uses
small. It also exposes optional conditioning audio.

## Long-form boundary

During prototyping:

- call local ComfyUI directly
- assemble with local FFmpeg
- keep the production worker, tunnel, Letta agent, callbacks, Discord approval,
  and public endpoints out of the render loop

Only add a dedicated long-form worker endpoint after the local manifest pipeline
has produced an approved complete video.

## Required probes

Check:

- `/system_stats`
- `/object_info/HuggingFaceMusicGen`
- candidate image loader nodes
- `/models/checkpoints`
- `/models/diffusion_models`
- `ffmpeg -version`
- `ffprobe -version`

Probe the installed FFmpeg build rather than assuming x264, x265, NVENC, CUDA,
libopus, libmp3lame, rubberband, or analysis-filter support.
