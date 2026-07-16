# Manual acceptance checklist

Automated coverage is in `core.test.mjs` and `browser.html`. Run this checklist against `index.html` both from `file://` and through a local HTTP server before a browser release.

| Browser | Version | Date | `file://` load | Editing / keyboard | Stable wrapping | Audio transport | Count-in / metronome | Playhead / rows | Persistence | JSON | Unavailable audio | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chrome | Not run — executable unavailable in this environment | — | — | — | — | — | — | — | — | — | — | Pending |
| Safari | Not run — executable unavailable in this environment | — | — | — | — | — | — | — | — | — | — | Pending |
| Firefox | Not run — executable unavailable in this environment | — | — | — | — | — | — | — | — | — | — | Pending |

## Acceptance steps

1. Open `index.html` directly. Load **Bleed** and confirm a 48-step comparison: Pattern A has hits at steps 1 and 9 (step 9 accented); Pattern B has hits at 1, 2, 3, and 5.
2. Load **The Art of Dying** and confirm a 180-step comparison, a silent 45-step Pattern B, and grouping `5,5,5,3,3,3,5,5,5,3,3`.
3. Cycle each cell through rest, hit, accent, rest using mouse and keyboard. Confirm labels communicate state without relying on color.
4. Change steps per row, resize the browser, and confirm the musical wrap does not change. Narrow windows must scroll horizontally rather than reflow cells.
5. Test play, pause, stop/reset, tempo, optional count-in, optional metronome, pattern mute, accents, and playhead row-following.
6. Save, rename, load, and delete a named exercise. Reload and verify the current draft restores.
7. Export an exercise, import it as a new unsaved exercise, then attempt malformed and unsupported-version JSON; confirm the current exercise remains unchanged and an inline error appears.
8. Block or remove `AudioContext` before loading; confirm editing and visualization remain usable and playback shows a clear warning.
