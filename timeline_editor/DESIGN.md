# Design

## Timeline Desk

The editor is a projection-room cue sheet: midnight-indigo work surface,
off-white type, muted mineral panels, and restrained poppy-orange for the live
playhead and destructive timing warnings. It uses a dense, editorial table
beside a large waveform rather than card grids. The waveform is the primary
visual object; media thumbnails are evidence, not decoration.

## Typography

Use a clear system sans stack for fast scanning. Use tabular figures for
timecodes and compact all-caps labels only for a few persistent controls.

## Interaction

The playhead is the central instrument. Clicking the waveform seeks. The
selected timeline row follows playback. Caption rows and visual-only rows share
one chronological cue sheet; visual-only rows show a blank lyric cell and their
own image In/Out so no media interval is hidden between lyrics. Keyboard
shortcuts and explicit Set In/Set Out
buttons perform the same timing action. Asset assignment is visible in the cue
row and reflected in a separate visual-beat list.

Preview-speed controls offer normal, 0.8×, 0.5×, 0.3×, and a custom rate. They
change browser playback only, preserve pitch where supported, and never alter
the soundtrack asset or saved timeline coordinates.

In/Out edits use boundary ripple by default. Moving a row's In hands the same
cut point to the previous visual; moving its Out hands the cut point to the next
visual. Nearby lyric boundaries move with their neighboring caption, but longer
lyric pauses remain intact. Keep a visible opt-out beside the time fields for
intentional black gaps, holds, or overlaps.

The program monitor sits beside the waveform and displays the still image,
looping animated GIF, or muted video active at the song playhead, with the
active caption burned into the preview only. GIFs restart on entry or seek and
carry an explicit `loop_to_timeline` assembly policy. Video source In/Out and
timeline In/Out remain separate controls. Its readout provides a direct Replace
visual action for the active timeline beat, including beats that occupy gaps
between lyric cues.

On desktop, keep the application frame fixed to the viewport. Show ten lyric
rows beneath the sticky table header and scroll only that cue-sheet window as
playback follows captions; never move the transport or program monitor offscreen.

Keep visual media in the fixed right column. Separate “Current cue” from the
searchable Library so replacing a shot is an explicit two-step action and adding
another beat cannot be mistaken for replacement.

Opening Library defaults to replacing the visual under the playhead and names
that target with its visual ID and preserved timeline range. If no visual is
active, disable asset selection instead of silently adding one. Creating another
beat requires an explicit Add-new mode and reports any resulting overlaps.

Keep the Library current without moving the playhead: scan the project `images`
folder when Library opens, every 15 seconds while it remains visible, and through
an explicit Refresh control. Report new or updated media in the Library itself.

## Responsive behavior

Prioritize desktop editing. On narrow screens, stack the inspector, waveform,
cue table, and media bin while preserving a sticky transport control.
