# Polyrhythm Practice Tool Specification

## 1. Summary

Build a desktop browser tool for constructing, comparing, hearing, and practicing two repeating rhythmic patterns. The interaction resembles a two-track step sequencer, but the product remains focused on polyrhythm practice: it visualizes the patterns across their complete realignment cycle, supports explicit subgroup annotations, and can loop either independently or at a user-defined phrase boundary.

The application must be a polished, dependency-free HTML file that works when opened directly from the local filesystem. It must not require a server or build step at runtime.

## 2. Goals

- Let users construct any two monophonic patterns on sixteenth-note grids.
- Make unequal pattern lengths and their eventual realignment visually understandable.
- Let users annotate patterns with explicit subgroup boundaries without changing their hits.
- Provide rhythmically reliable playback with distinct synthesized sounds.
- Support reusable built-in presets and user-created exercises.
- Preserve a stable musical layout: browser resizing must never change where the timeline wraps.

## 3. Non-goals for the MVP

- More than two editable pattern tracks
- Song arrangement or multi-section sequencing
- Triplet or variable grid resolutions
- Continuous velocity editing
- User-loaded audio samples
- Tap tempo or automatic tempo ramps
- Phone or tablet support
- Cloud storage, accounts, or collaboration
- MIDI input or output

Tablet and touch support is deferred to [GitHub issue #1](https://github.com/jarredbarber/math-art/issues/1).

## 4. Technical constraints

- Deliver the application as one self-contained HTML file with inline CSS and JavaScript.
- Use no external runtime dependencies, network requests, or remote assets.
- Support current desktop versions of Chrome, Safari, and Firefox.
- Work from a `file://` URL, including playback, persistence, and JSON import/export.
- Use the Web Audio API for synthesized playback.
- Keep state/model, timeline calculations, rendering, audio scheduling, persistence, and UI coordination internally modular even though they share one HTML file.

## 5. Core workflow

1. Start from a blank exercise, a built-in preset, a named saved exercise, or imported JSON.
2. Edit Pattern A and Pattern B in dedicated base-pattern editors.
3. Set each pattern's name, length, optional grouping, instrument, mute state, and cells.
4. Select independent-loop or phrase-loop behavior.
5. Inspect the generated read-only comparison timeline.
6. Set BPM, metronome, and count-in preferences.
7. Play, pause, stop, and practice the complete cycle.
8. Save the exercise locally or export it as JSON.

## 6. Application layout

### 6.1 Header and transport

The top-level controls contain:

- Exercise name
- BPM input
- Play/pause control
- Stop/reset control
- Optional one-bar count-in toggle
- Optional quarter-note metronome toggle
- Exercise and preset controls

### 6.2 Pattern editors

Pattern A and Pattern B have separate source-of-truth editors above the comparison timeline. Each editor displays:

- Editable pattern name
- Length in sixteenth-note steps
- Grouping input
- Instrument selector
- Accent-instrument selector (accent cells replace normal hits with this sound)
- Mute control
- One row of editable cells representing exactly one base cycle
- A legend for rest, normal hit, and accented hit

Clicking a cell repeatedly cycles through:

`rest -> hit -> accent -> rest`

The comparison timeline is not directly editable. This avoids ambiguity when the same base cell appears multiple times in a realignment cycle.

### 6.3 Loop controls

Users choose one of two modes:

- **Independent:** each pattern repeats at its own length.
- **Phrase:** both patterns reset after a separate user-entered phrase length.

Pattern A and Pattern B always begin together at step zero.

### 6.4 Comparison timeline

The comparison is a read-only, time-aligned timeline. Every segment contains a Pattern A lane directly above a Pattern B lane. It shows:

- Every sixteenth-note step in the comparison cycle
- Rest, hit, and accent states
- Pattern-cycle boundaries
- User-defined subgroup boundaries and labels
- Quarter-note beat markers
- Shared cycle start and end
- Current playback position

The complete timeline wraps into multiple paired rows. The user explicitly sets the number of steps per row; the default is 16 and the valid range is 4–64 whole steps. Browser resizing never changes this value or the musical row breaks. If a configured row is wider than the viewport, the music area scrolls horizontally.

When playback moves to another paired row, that row scrolls into view without changing the configured wrapping.

## 7. Exercise data model

An exercise contains:

- Schema version
- Exercise name
- BPM
- Loop mode
- Phrase length
- Steps per comparison row
- Count-in preference
- Metronome preference
- Pattern A
- Pattern B

Each pattern contains:

- Name
- Display color
- Length
- Cell states
- Optional grouping sequence
- Instrument
- Accent instrument
- Mute state

Cell states are `rest`, `hit`, or `accent`. Each pattern is monophonic. A normal hit uses Instrument; an accent replaces it with Accent instrument.

## 8. Validation and synchronization rules

### 8.1 Pattern length

- Pattern length is a whole number from 1 through 64 sixteenth-note steps.
- Changing length resizes the cell sequence.
- Shortening removes cells beyond the new endpoint only after user confirmation if any removed cell contains a hit or accent.

### 8.2 Grouping

Grouping is an optional comma-separated sequence of positive whole numbers, such as `5,5,5,3,3`. It is visual annotation only: changing grouping never creates, removes, or accents hits.

- A valid grouping sum defines the pattern length.
- Editing grouping updates the pattern length to match its sum.
- A grouping total greater than 64 is invalid.
- Manually changing the pattern length preserves grouping when the sum still matches.
- If the new length conflicts with grouping, the UI asks for confirmation before clearing the grouping.
- A completely blank grouping field clears grouping; empty elements inside a sequence (such as `5,,3`) are invalid.
- Invalid group entries display an inline error and are not applied.

### 8.3 Tempo and phrase length

- BPM is a whole number from 20 through 300.
- Phrase length is required only in phrase mode.
- Phrase length is a whole number from 1 through 4,096 sixteenth-note steps.
- Invalid structural or tempo values prevent playback and display an inline explanation near the relevant input.

## 9. Timeline calculation

### 9.1 Independent mode

The comparison length is:

`LCM(pattern A length, pattern B length)`

With pattern lengths capped at 64, the largest possible independent cycle is 4,032 steps.

### 9.2 Phrase mode

The comparison length is the user-entered phrase length. Each pattern repeats independently inside that window, and both restart when the phrase boundary is reached. The phrase may end partway through either base pattern.

### 9.3 Row segmentation

The timeline is divided sequentially according to the configured steps per row. A final partial row is allowed. Row segmentation changes presentation only; it does not alter timing, grouping, or loop boundaries.

## 10. Audio and transport

### 10.1 Instruments

Each pattern may select one of these dependency-free synthesized Web Audio sounds:

- Kick
- Snare
- Hi-hat
- Woodblock
- Click

The metronome uses its own fixed click sound. Accent cells replace the normal instrument with the pattern's Accent instrument. When both selectors name the same sound, accents instead play that sound louder and slightly brighter. Pattern mute controls do not affect the metronome.

### 10.2 Scheduling

Use a Web Audio look-ahead scheduler that queues notes ahead of playback. UI timers must not be the source of musical timing. The visual playhead follows the audio clock and may update less frequently than audio scheduling without affecting sound.

The audio context is created or resumed only after a user gesture to comply with autoplay policies.

### 10.3 Transport behavior

- **Play** begins at the current position or resumes paused playback.
- **Pause** stops scheduling while preserving the current position.
- **Stop** stops scheduling and resets to step zero.
- At the end of the comparison cycle, playback loops to step zero.
- Enabling count-in adds one bar of 4/4 quarter-note clicks before pattern playback; count-in is off by default.
- The optional metronome plays quarter notes throughout pattern playback and is independent of both patterns.
- Loading an exercise, changing loop mode, or structurally changing a pattern while playing stops and resets playback.
- Non-structural changes such as mute and instrument selection may take effect from the next schedulable hit.

## 11. Built-in presets

Loading a preset replaces the current exercise only after warning about unsaved named changes. It preserves the user's current BPM rather than imposing a song tempo.

### 11.1 Bleed — half-speed herta practice

This is an intentionally half-speed sixteenth-grid abstraction, not a note-for-note representation at the recording's grid resolution.

**Pattern A**

- Name: `Half-note reference`
- Length: 32
- Normal hi-hat hits: steps 1, 9, and 25
- Accented hit: step 17, using snare as its accent instrument
- Suggested normal instrument: hi-hat

**Pattern B**

- Name: `Herta`
- Length: 6
- Normal hits: steps 1, 2, 3, and 5
- No accents
- Suggested instrument: kick

Default loop mode is independent. The complete realignment cycle is 96 steps.

### 11.2 The Art of Dying

**Pattern A**

- Name: `Quarter-note pulse`
- Length: 4
- Normal hit: step 1
- Suggested instrument: woodblock

**Pattern B**

- Name: `45-step grouping`
- Length: 45
- No hits or accents
- Grouping: `5,5,5,3,3,3,5,5,5,3,3`
- Suggested instrument: kick, though the pattern is silent until edited

Default loop mode is independent. The complete realignment cycle is 180 steps.

Empty patterns are valid so this preset can use Pattern B as a visual grouping reference without producing audio.

## 12. Persistence and interchange

### 12.1 Local persistence

Use localStorage for:

- Automatically restoring the current draft
- Creating named exercises
- Renaming, overwriting, and deleting named exercises
- Remembering display and playback preferences included in each exercise

Built-in presets are immutable. Destructive replacement, overwrite, and deletion actions require confirmation. A localStorage failure shows a non-blocking warning and leaves the in-memory exercise usable.

### 12.2 JSON export and import

- Export downloads one complete, versioned exercise as JSON.
- Import accepts a local JSON file.
- Validate schema version, required fields, bounds, grouping sums, and cell values before changing application state.
- Failed import reports actionable errors and preserves the current exercise.
- Successful import creates a new unsaved exercise; it never silently overwrites a named exercise.

## 13. Visual design

The interface should look professional and purpose-built rather than like a generic form or demo sequencer.

- Use a dark, high-contrast visual system consistent with the other math-art tools.
- Give Pattern A and Pattern B distinct, colorblind-conscious colors.
- Differentiate rests, normal hits, and accents through shape or intensity as well as color.
- Keep labels, boundaries, and beat markers readable without overpowering hit states.
- Use fixed-size music cells so configured wrapping remains stable.
- Use clear focus states and native keyboard navigation for controls.
- Implement each music cell as a focusable control; Enter or Space cycles its state exactly like a click.
- Animate only playback state and restrained control feedback; avoid decorative motion.

## 14. Internal architecture

The single HTML file should maintain explicit internal boundaries:

1. **Exercise model and validation** — owns defaults, normalization, and valid state transitions.
2. **Rhythm math** — pure functions for GCD, LCM, repetition, phrase windows, grouping boundaries, and row segmentation.
3. **Pattern editor renderer** — renders and updates the two base cycles.
4. **Comparison renderer** — generates the read-only paired-row timeline and playhead state.
5. **Audio engine** — owns Web Audio nodes, scheduling, transport position, and instrument synthesis.
6. **Persistence adapter** — owns localStorage and versioned JSON import/export.
7. **UI controller** — coordinates user events and modules without duplicating domain rules.

Rhythm calculations and validation must remain independent of the DOM and Web Audio APIs so they can be tested directly.

## 15. Error handling

- Editing and visualization continue to work if Web Audio is unavailable or blocked; playback controls show a clear warning.
- Validation errors appear inline and do not discard the user's previous valid value.
- Imported or locally stored malformed data must not crash application startup.
- If the saved draft is invalid, retain it for recovery where practical, start from a safe blank exercise, and show a warning.
- A pattern with no hits is valid and must not be reported as an error.

## 16. Testing strategy

### 16.1 Automated browser-runnable tests

Keep a lightweight development test page or harness with no production runtime dependency. Test pure logic for:

- GCD and LCM, including the 4,032-step maximum case
- Independent comparison lengths
- Phrase-boundary resets
- Pattern repetition at arbitrary timeline offsets
- Group parsing, totals, validation, and synchronization
- Row segmentation, including final partial rows
- Cell resizing behavior
- Built-in preset definitions and expected cycle lengths
- JSON schema validation and version rejection
- Preservation of current state after failed imports

### 16.2 Manual acceptance tests

Verify in supported desktop browsers:

- Direct operation from a `file://` URL
- Cell-state cycling and confirmations
- Stable configured wrapping across browser resizing
- Horizontal scrolling for wide configured rows
- Accurate play/pause/stop behavior
- Count-in and metronome alignment
- Distinct instruments and audible accents
- Audio/playhead synchronization across wrapped rows and loop boundaries
- Draft restoration and named exercise lifecycle
- JSON export/import round trips
- Graceful behavior when storage or audio is unavailable

## 17. MVP acceptance criteria

The MVP is complete when:

1. A user can create and edit two 1–64-step patterns with rest, hit, and accent cells.
2. Optional grouping annotations display correctly and obey the synchronization rules.
3. Independent mode renders and plays the complete LCM cycle.
4. Phrase mode renders and plays the configured phrase cycle.
5. The paired comparison wraps at a persistent user-selected step count and never reflows due to browser resizing.
6. Playback uses reliable look-ahead scheduling with selectable pattern instruments, optional metronome, and optional one-bar count-in.
7. Both built-in presets match the definitions in this specification.
8. Named local exercises and versioned JSON import/export work without a server.
9. Invalid input and unavailable browser capabilities fail clearly without losing the current exercise.
10. The application passes the automated logic tests and manual desktop-browser acceptance checks.
