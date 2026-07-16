# Polyrhythm Accent Instruments and Text-Input Stability Design

## Goal

Let each pattern route accent cells to a distinct built-in instrument while fixing text fields that lose focus after each typed character.

## Scope

This follow-up changes the existing single-file `polyrhythm/index.html` application. It does not add tracks, samples, new instrument types, or a build system.

## Accent instruments

Each pattern gains an `accentInstrument` property and an **Accent instrument** selector beside its existing **Instrument** selector.

- Normal `hit` cells play `instrument`.
- `accent` cells replace the normal sound with `accentInstrument`; the two sounds are never layered.
- The existing accent gain/timbre emphasis continues only when `accentInstrument` equals `instrument`. When the instruments differ, the distinct selected instrument is the accent cue.
- `accentInstrument` accepts the same built-in values as `instrument`: `kick`, `snare`, `hihat`, `woodblock`, and `click`.
- New blank exercises default `accentInstrument` to `instrument`.
- Imported or locally restored legacy exercises that omit `accentInstrument` normalize it to the pattern's `instrument`, preserving previous sound behavior.
- Exercise validation rejects unknown accent-instrument values.

`eventsInRange` selects the normal instrument for `hit` cells and the accent instrument for `accent` cells. The Web Audio scheduler remains responsible only for synthesizing the selected event sound at its scheduled time.

## Revised Bleed preset

The built-in half-speed herta preset is updated without changing the user's BPM.

- Pattern A length: 32 sixteenth-note steps.
- Pattern A normal instrument: hi-hat.
- Pattern A accent instrument: snare.
- Pattern A active cells: normal hits at steps 1, 9, and 25; accent at step 17.
- Pattern B remains six steps with normal hits at steps 1, 2, 3, and 5 and no accents.
- Independent comparison cycle: LCM(32, 6) = 96 steps.

## Text-input stability

The current transport and editor input handlers call the application-wide `render()` on every `input` event. That replacement recreates the DOM input and loses focus after one keystroke.

BPM, pattern name, and grouping fields will instead:

1. Update in-memory exercise state on `input`.
2. Schedule local draft persistence.
3. Update only dependent display state when needed, without replacing the focused input.
4. Use a full render only for structural actions such as length changes, grouping application/clear actions, preset loading, loop-mode changes, imports, and saved-exercise actions.

For grouping, parsing and length changes occur only on explicit commit (`change` or Enter), rather than on every typed character. Invalid partial text remains editable and is shown as an inline error only after a commit attempt.

## Error handling

- An invalid accent-instrument value in imported JSON rejects the import without changing the current exercise.
- A legacy import without `accentInstrument` succeeds through normalization.
- Invalid BPM remains an inline validation error and blocks playback, but never causes focus loss.
- Failed grouping commits keep the entered text and current valid rhythm unchanged.

## Testing

Extend the Node test suite and browser harness to assert:

- Accent events use `accentInstrument`; normal hits use `instrument`.
- Legacy exercise normalization supplies the normal instrument as the accent instrument.
- Unknown accent-instrument values are validation errors.
- The Bleed preset has a 32-step Pattern A, hi-hat normal sound, snare accent sound, cells 1/9/25 as hits, step 17 as accent, and a 96-step independent cycle.
- A multi-character BPM entry does not invoke a full render and retains the input node/value.
- Grouping changes do not apply until an explicit commit.

Manual verification covers distinct normal/accent audio, saved/imported legacy exercises, and typing multi-digit BPM/name/grouping values without focus loss.
