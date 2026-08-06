# Rendering editor timelines with mixed media

Read this reference when an editor JSON, caption map, locked song, GIFs, videos,
or revisions of an approved render define the edit.

## Freeze the edit state

- Treat the named timeline file as the source of truth, not an older hardcoded
  renderer or stale browser state.
- Validate it, copy a run snapshot, and record its SHA-256 before rendering.
- Record caption count, visual-beat count, unique used assets, and resolved
  segment count. These numbers expose accidental timeline replacement.

## Resolve timeline semantics before FFmpeg

Match the editor's exact active-visual rule. If the editor selects the active
record with the latest start time, preserve that rule and its tie-breaking
order. A short overlapping beat temporarily masks a long beat; the long beat
resumes when the short beat ends.

Build the visible edit from the union of:

- timeline start and soundtrack end
- every visual start and end
- any picture-only effect or music-onset boundaries

Quantize those boundaries to output frames, choose the active visual at each
interval midpoint, and discard zero-frame intervals. Record any uncovered
interval. Carrying the preceding image across a one-frame rounding gap can be
reasonable when the project forbids blank visuals, but disclose it; require
review for larger gaps.

For a split video segment, calculate:

`source position = source_in + (segment_start - visual_start) * playback_rate`

## Render mixed media correctly

- Still: loop the input and encode the exact assigned frame count.
- GIF: preserve animation timing and loop to the visible interval only when the
  manifest requests it. Do not freeze the first frame.
- Video: honor source-in, source-out, and playback rate; ignore its audio unless
  explicitly requested. Confirm the source span is long enough after rate
  conversion.
- Normalize every segment to the same CFR, dimensions, time base, codec profile,
  pixel format, and sample aspect ratio before concatenation.
- Preserve portrait or unusual aspect ratios with an intentional contain,
  crop-anchor, or designed background treatment.

Animated-media QA must sample two frames safely inside each visible interval.
Seeking on or within one frame of a cut can return the next shot and produce a
false pass. Use samples at least 2-3 frames from boundaries, calculate a simple
pixel-difference metric, and visually inspect a labeled A/B contact sheet.

## Build impact without touching the song

Analyze waveform, spectrogram, or onset energy from the locked soundtrack to
place picture events. This analysis does not authorize audio processing.

For a climax or instrumental coda:

- contrast a restrained or elegiac passage with a clear visual rupture
- reserve slam zooms, crop-anchor jumps, chromatic shifts, grain, and impact
  frames for measured transients
- subdivide a long visual beat into picture-only effect segments using the same
  asset when new imagery is unavailable
- vary zoom scale and crop anchor so repeated subcuts feel intentional
- use one- to three-frame flashes sparingly; avoid sustained rapid flashing and
  consider photosensitivity risk
- end with a picture-only hold, release, or blackout; never fade the locked song
  unless explicitly requested

Record onset times and the resolved filter graph in the run report. A strong
ending should be legible as an emotional state change, not merely as more noise.

## Revise an approved ending without drift

- Create a new numbered run for every accepted revision. Never overwrite the
  last approved master, timeline snapshot, preview, or QA report.
- Render from the earliest approved source that already contains the unchanged
  body of the film. Avoid repeatedly re-encoding successive derivatives when
  the same pre-coda master and source assets remain available.
- Record the parent master, exact cut frame, replaced frame count, asset paths
  and hashes, transition times, effect parameters, and soundtrack policy as a
  compact revision delta.
- For a small ending change, render the coda alone first with the corresponding
  soundtrack excerpt mapped directly. Inspect its contact sheet before paying
  the cost of a full-quality encode.
- Keep cut points frame-exact. Define the coda by `start_frame` and
  `frame_count`, then derive seconds from the output frame rate rather than
  independently rounding both representations.

When an accelerating alternation must fade into darkness, apply a continuous
video-only fade after the alternation, motion, and texture filters. Keep the cuts
active beneath the fade so the image rhythm continues while the narrative state
changes. For a fade beginning halfway through a coda, derive:

`fade_start = coda_frame_count / (2 * fps)`

`fade_duration = coda_frame_count / fps - fade_start`

Prefer luminance-matched source images and holds measured in substantial
fractions of a second over flash frames or polarity reversals. About 0.7 seconds
is a conservative starting hold for strongly contrasting stills, not a safety
guarantee; review the actual encoded sequence and avoid claiming medical safety.

## Preserve the soundtrack explicitly

Map the intended audio stream by type and index, for example `1:a:0`. MP3 files
may also contain attached cover art, so automatic mapping is unsafe.

Use stream copy when the delivery container supports the codec. Compare source
and delivered audio with a stream hash such as:

```powershell
ffmpeg -v error -i input.mp3 -map 0:a:0 -c copy -f streamhash -hash sha256 -
ffmpeg -v error -i master.mp4 -map 0:a:0 -c copy -f streamhash -hash sha256 -
```

The hashes must match for a bitstream-preserved master. A video duration rounded
to the nearest frame may differ from the audio duration by less than one frame;
record both rather than trimming either stream to hide the difference.

## Enforce delivery geometry and color

Filters such as image decoders, overlays, and `zoompan` can silently propagate
full-range JPEG formats or a nearly-square nonstandard SAR even when the picture
looks normal. After shot motion and again after global effects/captions, force a
portable output contract, for example:

```text
scale=iw:ih:out_range=tv,format=yuv420p,setsar=1
```

Then verify with ffprobe:

- exact width, height, and CFR frame count
- SAR `1:1` and expected DAR
- `yuv420p` or the selected delivery format
- intentional TV/full color range
- video duration within one frame of the locked soundtrack

## Final QA

- Run a full decode to a null sink and require exit code zero.
- Compare source and muxed audio stream hashes and properties.
- Inspect a full-film sample sheet plus opening, peak, consequence, coda entry,
  fade midpoint, final accent, and last decodable frame.
- Sample the last frame at or before `(frame_count - 1) / fps`; seeking to the
  nominal container duration can return no image.
- Run black detection and reconcile every reported interval with intentional
  edit state. A progressive final fade may legitimately produce a short detected
  blackout before the nominal end.
- Preserve the exact commands, filter script, revision delta, resolved segments,
  asset inventory, and QA output inside the run.
