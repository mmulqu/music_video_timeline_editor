# Music Video Timeline Editor

A local, soundtrack-first editor for timing lyric captions and assigning still
images, animated GIFs, or videos to a song. It saves a plain
`music-video-timeline/v1` JSON manifest for deterministic FFmpeg assembly.

## What it protects

The supplied song is the locked timeline authority. The editor does not trim,
splice, normalize, retime, or re-encode it. Captions and visual beats move around
the song.

Opening **Library** defaults to replacing the visual under the playhead. The
editor names the targeted visual and preserves its exact timeline In/Out. Adding
another visual beat requires the separate **+ Add new beat** mode and reports
overlaps.

The cue sheet interleaves lyrics with uncaptioned `VIS` rows, so every image
interval can be found and edited. Preview playback can be slowed without
changing saved timecodes or the soundtrack. **Ripple boundaries** is enabled by
default: image cuts stay continuous, nearby lyric edges move together, and
longer intentional lyric pauses remain intact.

## Run locally

Requirements: Python 3.10+ and a current Chromium-based browser. FFmpeg and
ffprobe are required only for downstream validation and rendering.

On Windows:

```powershell
.\timeline_editor\start-editor.ps1
```

Or start the server directly:

```powershell
python timeline_editor/tools/serve_editor.py --directory . --port 8878
```

Then open <http://127.0.0.1:8878/timeline_editor/>.

1. Use **Load music** and choose the finished song. Keep that file in the
   repository root when assembling later.
2. Edit caption copy and In/Out at the playhead, or open an existing timeline.
   Use the speed presets or custom field for close timing work. Disable
   **Ripple boundaries** only when you intentionally want a gap or overlap.
3. Put reusable visual files in `images/`. Library scans that directory when it
   opens, every 15 seconds while visible, and whenever **Refresh** is pressed.
4. Seek to a caption or blank-lyric `VIS` row and choose a Library asset to
   replace it without retiming.
5. Save the timeline JSON.

The browser can also import individual files or a complete project folder.
Individual files remain session-only until they have a project-relative path.

## Validate a saved timeline

```powershell
python timeline_editor/tools/validate_timeline_manifest.py path/to/timeline.json
```

The validator checks the locked soundtrack fingerprint and duration, caption
ordering, media paths, GIF policy, visual timing, and video source ranges.

## Included Codex skill

`skills/compose-abstract-story-video` contains the reusable workflow developed
alongside the editor: treatment and storyboard gates, supplied-image handling,
ComfyUI/MusicGen/FFmpeg responsibilities, lyric timestamp alignment, soundtrack
locking, technical QA, and the documented limits of experimental voice-clone
pronunciation repairs.

Install it by copying that directory into your Codex skills directory, for
example `$CODEX_HOME/skills/compose-abstract-story-video`.

## Repository layout

```text
timeline_editor/                       browser application and local server
skills/compose-abstract-story-video/   Codex skill, references, scripts, assets
images/                                local project media convention
```

No soundtrack, private timeline, browser profile, generated project media, API
key, or other credential is included.
