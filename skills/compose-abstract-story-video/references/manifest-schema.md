# Story manifest schema

Use one JSON manifest as the source of truth for creative state, generated
assets, approvals, and render settings.

## Required top-level fields

| Field | Type | Meaning |
|---|---|---|
| `project_id` | string | stable lowercase run identifier |
| `title` | string | human title |
| `duration_target` | number | target seconds |
| `resolution` | two integers | final width and height |
| `fps` | number | final frames per second |
| `image_backend` | string | selected image workflow/model |
| `music_backend` | string | selected MusicGen model |
| `audio_crossfade_seconds` | number | overlap between movements |
| `acts` | array | ordered narrative acts |
| `shots` | array | ordered still-image shots |
| `music_movements` | array | ordered generated music clips |
| `render` | object | proxy and final delivery settings |

## Act

Required:

- `id`
- `title`
- `story_function`
- `visual_state`
- `music_state`

## Shot

Required:

- `id`
- `act_id`
- `duration`
- `source_type` (`generated` or `supplied`)
- `width`
- `height`
- `motion`
- `transition`
- `asset_path`
- `generation_status`
- `approval_status`

Generated shots additionally require `prompt`, `negative_prompt`, and `seed`.
Supplied shots additionally require `source_path`, recording the untouched
original. `asset_path` points to the frozen run copy or normalized derivative
used by the edit.

`generation_status` is one of `pending`, `running`, `complete`, `failed`.
`approval_status` is one of `unreviewed`, `approved`, `rejected`.

## Music movement

Required:

- `id`
- `act_id`
- `duration`
- `prompt`
- `seed`
- `guidance_scale`
- `temperature`
- `asset_path`
- `generation_status`
- `approval_status`

The local MusicGen duration must be between 1 and 30 seconds. Every music prompt
must explicitly require instrumental output without vocals or spoken word.

## Timing rules

Approximate joined music duration:

`sum(movement durations) - crossfade * (movement count - 1)`

Shot durations should match the resolved timeline within one output video frame.
The target may differ before music review; record the resolved duration in
`render.resolved_duration`.

## Asset rules

- Use paths relative to the run directory when practical.
- Never overwrite approved assets.
- Never modify a supplied original in place.
- Record the backend, full prompt, seed, and output path before marking complete.
- A missing asset invalidates `complete` status.
- Do not infer approval from file existence.
