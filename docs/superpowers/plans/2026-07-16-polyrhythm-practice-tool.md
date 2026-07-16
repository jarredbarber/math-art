# Polyrhythm Practice Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, dependency-free desktop browser tool for editing, comparing, hearing, saving, and sharing two repeating sixteenth-note patterns.

**Architecture:** `polyrhythm/index.html` is the only production artifact and contains internally separated CSS and JavaScript modules. Pure model, validation, rhythm-math, scheduling, preset, and serialization functions are exposed through `window.PolyrhythmCore`; DOM rendering, Web Audio, persistence, and UI coordination consume that API. A development-only Node harness extracts the core script from the HTML so logic can be tested without adding production dependencies or a build step.

**Tech Stack:** Semantic HTML, inline CSS, vanilla JavaScript, Web Audio API, localStorage, Blob/File APIs, Node.js built-in test/assert/vm modules.

## Global Constraints

- Deliver the production application as `polyrhythm/index.html`, one self-contained HTML file with inline CSS and JavaScript.
- Use no external runtime dependencies, network requests, remote assets, or runtime build step.
- Support current desktop Chrome, Safari, and Firefox, including direct use from a `file://` URL.
- Keep exactly two editable monophonic tracks on a fixed sixteenth-note grid.
- Pattern lengths are whole numbers from 1 through 64; BPM is 20–300; phrase length is 1–4,096; steps per row is 4–64.
- Browser resizing must never change configured timeline wrapping.
- Use Web Audio look-ahead scheduling; UI timers are not the musical clock.
- Preserve explicit boundaries between core logic, rendering, audio, persistence, and coordination inside the single HTML file.
- Use test-driven development for logic and behavior; run the complete test suite before each commit.
- Commit and push each completed task as a milestone.

## File Structure

- Create: `polyrhythm/index.html` — complete production application: markup, styles, pure core, renderers, audio engine, persistence adapter, and controller.
- Create: `polyrhythm/tests/core.test.mjs` — dependency-free CLI tests that extract and execute `script#polyrhythm-core` from `index.html`.
- Create: `polyrhythm/tests/browser.html` — browser-runnable mirror harness for the pure core suite, loading the production app in an iframe without production dependencies.
- Create: `polyrhythm/tests/manual-checklist.md` — supported-browser and `file://` acceptance record.
- Modify: `README.md` — link to the finished GitHub Pages application and summarize its features.

---

### Task 1: Application Shell and Rhythm-Math Core

**Files:**
- Create: `polyrhythm/index.html`
- Create: `polyrhythm/tests/core.test.mjs`
- Create: `polyrhythm/tests/browser.html`

**Interfaces:**
- Produces: `window.PolyrhythmCore.CELL`, `gcd(a, b)`, `lcm(a, b)`, `cycleLength(exercise)`, `cellAt(pattern, timelineStep)`, and `segmentRows(totalSteps, stepsPerRow)`.
- Produces: semantic application regions with IDs `app`, `transport`, `pattern-editors`, `loop-controls`, `comparison`, and `status-region`.

- [ ] **Step 1: Write the failing rhythm-math tests**

Create `polyrhythm/tests/core.test.mjs` with an extractor that evaluates only the pure core script:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const match = html.match(/<script id="polyrhythm-core">([\s\S]*?)<\/script>/);
assert.ok(match, "index.html must contain script#polyrhythm-core");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(match[1], context);
const core = context.window.PolyrhythmCore;

const pattern = (length, cells = []) => ({
  name: "Pattern",
  color: "#22d3ee",
  length,
  cells: Array.from({ length }, (_, index) => cells[index] ?? "rest"),
  grouping: [],
  instrument: "click",
  muted: false,
});

test("gcd and lcm handle normal and maximum pattern pairs", () => {
  assert.equal(core.gcd(45, 4), 1);
  assert.equal(core.lcm(16, 6), 48);
  assert.equal(core.lcm(63, 64), 4032);
});

test("cycleLength selects independent LCM or phrase length", () => {
  const exercise = { loopMode: "independent", phraseLength: 32, patterns: [pattern(16), pattern(6)] };
  assert.equal(core.cycleLength(exercise), 48);
  exercise.loopMode = "phrase";
  assert.equal(core.cycleLength(exercise), 32);
});

test("cellAt repeats a base pattern at arbitrary offsets", () => {
  const p = pattern(3, ["hit", "rest", "accent"]);
  assert.equal(core.cellAt(p, 0), "hit");
  assert.equal(core.cellAt(p, 4), "rest");
  assert.equal(core.cellAt(p, 8), "accent");
});

test("segmentRows keeps configured wrapping and allows a partial final row", () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(core.segmentRows(45, 16))),
    [{ start: 0, length: 16 }, { start: 16, length: 16 }, { start: 32, length: 13 }],
  );
});
```

- [ ] **Step 2: Run the tests and verify the expected failure**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: FAIL because `polyrhythm/index.html` or `script#polyrhythm-core` does not exist.

- [ ] **Step 3: Create the semantic shell, visual tokens, and pure rhythm functions**

Create `polyrhythm/index.html` with:

- A standards-mode document, UTF-8 and viewport metadata, title `Polyrhythm Practice Tool`.
- Inline dark-theme CSS variables: `--bg: #090d15`, `--panel: #121925`, `--panel-raised: #182232`, `--text: #edf2f7`, `--muted: #94a3b8`, `--a: #f5a623`, `--b: #22c5d6`, `--danger: #fb7185`, and fixed `--cell-size: 2rem`.
- A centered desktop shell, sticky transport, raised editor cards, visible `:focus-visible` outlines, restrained transitions, and `.music-scroll { overflow-x: auto; }`.
- Semantic empty regions matching the interface IDs.
- A `<script id="polyrhythm-core">` containing the exact core API below.

```js
(() => {
  "use strict";
  const CELL = Object.freeze({ REST: "rest", HIT: "hit", ACCENT: "accent" });

  function assertPositiveInteger(value, label) {
    if (!Number.isInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer`);
  }

  function gcd(a, b) {
    assertPositiveInteger(a, "a");
    assertPositiveInteger(b, "b");
    while (b !== 0) [a, b] = [b, a % b];
    return a;
  }

  function lcm(a, b) {
    return (a / gcd(a, b)) * b;
  }

  function cycleLength(exercise) {
    return exercise.loopMode === "phrase"
      ? exercise.phraseLength
      : lcm(exercise.patterns[0].length, exercise.patterns[1].length);
  }

  function cellAt(pattern, timelineStep) {
    return pattern.cells[timelineStep % pattern.length];
  }

  function segmentRows(totalSteps, stepsPerRow) {
    const rows = [];
    for (let start = 0; start < totalSteps; start += stepsPerRow) {
      rows.push({ start, length: Math.min(stepsPerRow, totalSteps - start) });
    }
    return rows;
  }

  window.PolyrhythmCore = Object.freeze({ CELL, gcd, lcm, cycleLength, cellAt, segmentRows });
})();
```

- [ ] **Step 4: Run the core tests**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Add and run the browser harness**

Create `polyrhythm/tests/browser.html`. It must load `../index.html` in an iframe, wait for `load`, read `frame.contentWindow.PolyrhythmCore`, execute browser equivalents of the four Task 1 assertions, and render a visible summary (`4 passed, 0 failed`) plus individual failure stacks. Use a tiny local `assertEqual(actual, expected, message)` helper comparing JSON-serialized values; do not add a library.

Run: `python3 -m http.server 8000`, open `http://localhost:8000/polyrhythm/tests/browser.html`, and verify `4 passed, 0 failed`. Then open `http://localhost:8000/polyrhythm/`, verify the dark application shell renders with no console errors, and stop the server.

For every later task that adds cases to `core.test.mjs`, add the equivalent cases to the browser harness in the same red/green cycle. The final browser harness must cover every pure-logic category in SPEC.md §16.1.

- [ ] **Step 6: Commit the milestone**

```bash
git add polyrhythm/index.html polyrhythm/tests/core.test.mjs polyrhythm/tests/browser.html
git commit -m "feat: add polyrhythm app shell and rhythm core"
git push origin main
```

Expected: commit and push succeed.

---

### Task 2: Exercise Model, Validation, State Transitions, and Presets

**Files:**
- Modify: `polyrhythm/index.html` in `script#polyrhythm-core`
- Modify: `polyrhythm/tests/core.test.mjs`
- Modify: `polyrhythm/tests/browser.html` with equivalent browser cases

**Interfaces:**
- Consumes: `CELL`, `lcm`, and `cycleLength` from Task 1.
- Produces: `SCHEMA_VERSION`, `INSTRUMENTS`, `createBlankExercise()`, `parseGrouping(text)`, `validateExercise(value)`, `resizePattern(pattern, length)`, `applyGrouping(pattern, text)`, `cycleCell(state)`, `PRESETS`, and `cloneExercise(value)`.
- Data shape: `{schemaVersion, name, bpm, loopMode, phraseLength, stepsPerRow, countIn, metronome, patterns:[Pattern, Pattern]}`.

- [ ] **Step 1: Add failing model and preset tests**

Append tests that assert:

```js
test("cycleCell follows rest, hit, accent, rest", () => {
  assert.equal(core.cycleCell("rest"), "hit");
  assert.equal(core.cycleCell("hit"), "accent");
  assert.equal(core.cycleCell("accent"), "rest");
});

test("parseGrouping accepts positive CSV and rejects holes", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(core.parseGrouping("5, 5,3"))), [5, 5, 3]);
  assert.deepEqual(JSON.parse(JSON.stringify(core.parseGrouping("   "))), []);
  assert.throws(() => core.parseGrouping("5,,3"), /positive whole numbers/);
  assert.throws(() => core.parseGrouping("40,25"), /64/);
});

test("applying grouping changes length without changing existing hits", () => {
  const p = pattern(4, ["hit", "rest", "accent", "rest"]);
  const next = core.applyGrouping(p, "3,3");
  assert.equal(next.length, 6);
  assert.deepEqual(Array.from(next.cells.slice(0, 4)), p.cells);
  assert.deepEqual(Array.from(next.cells.slice(4)), ["rest", "rest"]);
  assert.deepEqual(Array.from(next.grouping), [3, 3]);
});

test("shortening reports discarded active cells before applying", () => {
  const p = pattern(4, ["rest", "rest", "hit", "accent"]);
  const result = core.resizePattern(p, 2);
  assert.equal(result.requiresConfirmation, true);
  assert.deepEqual(Array.from(result.discarded), ["hit", "accent"]);
  assert.equal(result.pattern.length, 2);
});

test("Bleed and Art of Dying presets match the specification", () => {
  const bleed = core.PRESETS.bleed;
  assert.equal(bleed.patterns[0].length, 16);
  assert.deepEqual(bleed.patterns[0].cells.map((v, i) => v !== "rest" ? [i + 1, v] : null).filter(Boolean), [[1, "hit"], [9, "accent"]]);
  assert.deepEqual(bleed.patterns[1].cells.map((v, i) => v !== "rest" ? i + 1 : null).filter(Boolean), [1, 2, 3, 5]);
  assert.equal(core.cycleLength(bleed), 48);

  const dying = core.PRESETS.artOfDying;
  assert.deepEqual(Array.from(dying.patterns[1].grouping), [5,5,5,3,3,3,5,5,5,3,3]);
  assert.ok(dying.patterns[1].cells.every(value => value === "rest"));
  assert.equal(core.cycleLength(dying), 180);
});

test("validateExercise returns field-specific errors", () => {
  const invalid = core.createBlankExercise();
  invalid.bpm = 301;
  invalid.stepsPerRow = 3;
  const result = core.validateExercise(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.bpm, /20.*300/);
  assert.match(result.errors.stepsPerRow, /4.*64/);
});
```

Update the fixture’s `cells` comparisons through `Array.from` where values cross the VM realm.

- [ ] **Step 2: Run tests and verify the new failures**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: existing tests pass and new tests fail because model APIs are undefined.

- [ ] **Step 3: Implement immutable model helpers and validation**

Add to `script#polyrhythm-core`:

```js
const SCHEMA_VERSION = 1;
const INSTRUMENTS = Object.freeze(["kick", "snare", "hi-hat", "woodblock", "click"]);
const cloneExercise = value => JSON.parse(JSON.stringify(value));
const makeCells = (length, active = {}) => Array.from({ length }, (_, index) => active[index + 1] ?? CELL.REST);

function makePattern({ name, color, length, active = {}, grouping = [], instrument }) {
  return { name, color, length, cells: makeCells(length, active), grouping: [...grouping], instrument, muted: false };
}

function createBlankExercise() {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: "Untitled Exercise",
    bpm: 80,
    loopMode: "independent",
    phraseLength: 16,
    stepsPerRow: 16,
    countIn: false,
    metronome: false,
    patterns: [
      makePattern({ name: "Pattern A", color: "#f5a623", length: 16, instrument: "snare" }),
      makePattern({ name: "Pattern B", color: "#22c5d6", length: 12, instrument: "kick" }),
    ],
  };
}

function parseGrouping(text) {
  if (text.trim() === "") return [];
  const tokens = text.split(",");
  if (tokens.some(token => !/^\s*[1-9]\d*\s*$/.test(token))) {
    throw new RangeError("Groups must be comma-separated positive whole numbers");
  }
  const groups = tokens.map(Number);
  if (groups.reduce((sum, value) => sum + value, 0) > 64) throw new RangeError("Grouping total cannot exceed 64");
  return groups;
}

function resizePattern(pattern, length) {
  if (!Number.isInteger(length) || length < 1 || length > 64) throw new RangeError("Pattern length must be 1–64");
  const discarded = pattern.cells.slice(length).filter(state => state !== CELL.REST);
  const cells = Array.from({ length }, (_, index) => pattern.cells[index] ?? CELL.REST);
  return {
    pattern: { ...pattern, length, cells, grouping: pattern.grouping.reduce((a, b) => a + b, 0) === length ? [...pattern.grouping] : [] },
    discarded,
    requiresConfirmation: discarded.length > 0 || (pattern.grouping.length > 0 && pattern.grouping.reduce((a, b) => a + b, 0) !== length),
  };
}

function applyGrouping(pattern, text) {
  const grouping = parseGrouping(text);
  if (grouping.length === 0) return { ...pattern, grouping: [] };
  const length = grouping.reduce((sum, value) => sum + value, 0);
  return { ...resizePattern(pattern, length).pattern, grouping };
}

function cycleCell(state) {
  if (state === CELL.REST) return CELL.HIT;
  if (state === CELL.HIT) return CELL.ACCENT;
  return CELL.REST;
}
```

Create frozen `PRESETS` from `createBlankExercise()`-compatible literals. Bleed uses the exact step states and instruments from the spec; Art of Dying uses the exact 45-step grouping and an all-rest Pattern B. Implement `validateExercise` as a non-mutating shape/bounds validator returning `{ valid, errors }`, with keys `schemaVersion`, `name`, `bpm`, `loopMode`, `phraseLength`, `stepsPerRow`, and `patterns.0`/`patterns.1` as applicable. Validate cell count equals length, all cell values belong to `CELL`, grouping sum equals length when nonempty, and instrument belongs to `INSTRUMENTS`.

Export every interface listed above through `window.PolyrhythmCore`.

- [ ] **Step 4: Run all model tests**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: all tests pass, 0 fail.

- [ ] **Step 5: Commit and push the model milestone**

```bash
git add polyrhythm/index.html polyrhythm/tests/core.test.mjs
git commit -m "feat: add exercise model validation and presets"
git push origin main
```

Expected: commit and push succeed.

---

### Task 3: Pattern Editors, Loop Controls, and Validation UI

**Files:**
- Modify: `polyrhythm/index.html` after `script#polyrhythm-core`
- Modify: `polyrhythm/tests/core.test.mjs`
- Modify: `polyrhythm/tests/browser.html` with equivalent browser cases

**Interfaces:**
- Consumes: all Task 2 model helpers.
- Produces: `window.PolyrhythmApp` with `getState()`, `setExercise(exercise, options)`, `render()`, and `stopAndReset()`; reusable `renderPatternEditor(pattern, index)`.
- UI contract: every cell is a `<button class="pattern-cell" data-pattern data-step data-state>` with an accessible state label.

- [ ] **Step 1: Add failing source-contract and transition tests**

Append tests for cloning and core immutability, then add a static source test:

```js
test("cloneExercise prevents preset mutation", () => {
  const copy = core.cloneExercise(core.PRESETS.bleed);
  copy.patterns[0].cells[0] = "accent";
  assert.equal(core.PRESETS.bleed.patterns[0].cells[0], "hit");
});

test("production markup contains accessible editor and transport contracts", () => {
  for (const token of [
    'id="transport"', 'id="pattern-editors"', 'id="loop-controls"',
    'aria-live="polite"', 'class="pattern-cell"', 'data-state',
  ]) assert.ok(html.includes(token), `missing ${token}`);
});
```

- [ ] **Step 2: Run tests and verify the markup-contract failure**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: clone test passes; markup contract fails because rendered editor markup is absent from source.

- [ ] **Step 3: Implement state coordination and editor rendering**

Add a normal inline script after the core script. Keep one private `state` containing `{ exercise, savedName, dirty, validationErrors, currentStep }`. Implement:

- `renderTransport()` with exercise name, numeric BPM, play/pause and stop buttons, count-in and metronome checkboxes, and preset/save controls.
- `renderPatternEditor(pattern, index)` with name, numeric length, grouping text, instrument select, mute checkbox, legend, inline error slots, and one fixed-size base-cycle row.
- Cell buttons whose text/shape differentiates rest (`·`), hit (`●`), and accent (`◆`); `aria-label` includes pattern name, one-based step, and state.
- Delegated click handling that calls `cycleCell`, updates one cloned pattern, marks dirty, auto-saves later through a controller hook, and rerenders.
- Native Enter/Space activation by using actual buttons rather than custom keyboard handlers.
- Length handling that calls `resizePattern`; when `requiresConfirmation`, call `confirm("Changing length will discard active cells or incompatible grouping. Continue?")` before applying.
- Grouping handling on `change`; call `applyGrouping`, preserve the last valid pattern on failure, and display the thrown message inline.
- Phrase-length visibility only in phrase mode.
- Structural edits (cell, length, grouping, loop mode, phrase length) calling `stopAndReset()` before state replacement. Instrument and mute changes do not reset.
- Numeric fields retaining the typed invalid value in the input while the previous valid model value stays intact; inline errors prevent playback.

Use `textContent`, `createElement`, and fixed trusted templates only; never interpolate imported names into `innerHTML`.

- [ ] **Step 4: Complete editor styling and rerun tests**

Add CSS for two editor cards, a fixed-width `.base-grid`, three cell-state shapes/intensities, subgroup braces below the base grid, inline `.field-error`, muted pattern treatment, and desktop overflow. Ensure resizing the browser only introduces scrolling and never changes `.base-grid` columns.

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: all tests pass, including source contracts.

- [ ] **Step 5: Manually verify editing and commit**

Open `polyrhythm/index.html` directly as a `file://` URL in Chrome. Verify rest → hit → accent → rest by mouse and keyboard, destructive shortening confirmation, grouping-driven resize, conflicting manual resize confirmation, invalid-input preservation, mute/instrument changes, and phrase controls.

```bash
git add polyrhythm/index.html polyrhythm/tests/core.test.mjs
git commit -m "feat: add accessible pattern editing workflow"
git push origin main
```

Expected: commit and push succeed.

---

### Task 4: Full Paired-Row Comparison Timeline

**Files:**
- Modify: `polyrhythm/index.html`
- Modify: `polyrhythm/tests/core.test.mjs`
- Modify: `polyrhythm/tests/browser.html` with equivalent browser cases

**Interfaces:**
- Consumes: `cycleLength`, `cellAt`, `segmentRows`, model state, and pattern colors.
- Produces: `groupBoundaryAt(pattern, timelineStep)`, `timelineRows(exercise)`, `renderComparison(exercise, currentStep)`, and `updatePlayhead(step)`.

- [ ] **Step 1: Add failing timeline projection tests**

```js
test("groupBoundaryAt repeats labels and boundaries across cycles", () => {
  const p = { ...pattern(8), grouping: [3, 5] };
  assert.deepEqual(JSON.parse(JSON.stringify(core.groupBoundaryAt(p, 0))), { startsGroup: true, size: 3 });
  assert.deepEqual(JSON.parse(JSON.stringify(core.groupBoundaryAt(p, 3))), { startsGroup: true, size: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(core.groupBoundaryAt(p, 8))), { startsGroup: true, size: 3 });
  assert.equal(core.groupBoundaryAt(p, 2), null);
});

test("timelineRows projects paired repeating lanes", () => {
  const exercise = core.createBlankExercise();
  exercise.patterns = [pattern(4, ["hit"]), pattern(3, ["accent"] )];
  exercise.stepsPerRow = 5;
  const rows = core.timelineRows(exercise);
  assert.equal(rows.length, 3);
  assert.deepEqual(Array.from(rows[0].a), ["hit", "rest", "rest", "rest", "hit"]);
  assert.deepEqual(Array.from(rows[0].b), ["accent", "rest", "rest", "accent", "rest"]);
  assert.equal(rows[2].length, 2);
});
```

- [ ] **Step 2: Run tests and verify missing timeline APIs**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: new tests fail because `groupBoundaryAt` and `timelineRows` are undefined.

- [ ] **Step 3: Implement pure timeline projection**

In the core script, implement group starts using cumulative offsets modulo pattern length. `timelineRows(exercise)` must return rows with `{start, length, a, b}` where `a` and `b` are state arrays projected from the base patterns for every timeline step. Export both functions.

- [ ] **Step 4: Render stable paired rows and live playhead hooks**

Implement `renderComparison` so each segment creates:

- A row header such as `Steps 1–16`.
- Beat numbers and quarter-note markers based on absolute timeline step modulo 4/16.
- Pattern A lane immediately above Pattern B.
- Pattern-cycle boundary styling whenever `timelineStep % pattern.length === 0`.
- Repeated subgroup brackets and numeric labels from `groupBoundaryAt`.
- Shared cycle start/end styling.
- Exactly `exercise.stepsPerRow` fixed-size grid columns for full rows and the actual length for the final partial row.
- No direct editing listeners.

Set `data-timeline-step` and `data-row-index` attributes. `updatePlayhead(step)` removes the prior active state, marks both active lane cells, updates `aria-current="true"`, and calls `scrollIntoView({ block: "nearest", behavior: "smooth" })` only when the paired row changes. Re-render only after structural changes; use class changes for playhead ticks.

- [ ] **Step 5: Verify logic and stable wrapping**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: all tests pass.

Open the app, load both presets, verify Bleed renders 48 steps and Art of Dying 180 steps, set steps per row to 4, 16, and 64, resize the window, and confirm musical row breaks never move. Confirm wide rows scroll horizontally.

- [ ] **Step 6: Commit and push the timeline milestone**

```bash
git add polyrhythm/index.html polyrhythm/tests/core.test.mjs
git commit -m "feat: render complete polyrhythm comparison cycles"
git push origin main
```

Expected: commit and push succeed.

---

### Task 5: Web Audio Instruments and Look-Ahead Transport

**Files:**
- Modify: `polyrhythm/index.html`
- Modify: `polyrhythm/tests/core.test.mjs`
- Modify: `polyrhythm/tests/browser.html` with equivalent browser cases

**Interfaces:**
- Consumes: exercise state, `cycleLength`, `cellAt`, `updatePlayhead`, instruments, mute state.
- Produces: `secondsPerStep(bpm)`, `eventsInRange(exercise, fromStep, count)`, and private `AudioEngine` methods `play()`, `pause()`, `stop()`, `setExercise()`, and `destroy()`.

- [ ] **Step 1: Add failing scheduling tests**

```js
test("secondsPerStep treats each grid cell as a sixteenth note", () => {
  assert.equal(core.secondsPerStep(60), 0.25);
  assert.equal(core.secondsPerStep(120), 0.125);
});

test("eventsInRange emits hits, accents, metronome, and wraps", () => {
  const exercise = core.createBlankExercise();
  exercise.patterns = [pattern(4, ["hit", "rest", "accent", "rest"]), pattern(3, ["rest", "hit", "rest"] )];
  exercise.metronome = true;
  const events = core.eventsInRange(exercise, 0, 5);
  assert.ok(events.some(event => event.source === "a" && event.step === 0 && event.state === "hit"));
  assert.ok(events.some(event => event.source === "a" && event.step === 2 && event.state === "accent"));
  assert.ok(events.some(event => event.source === "b" && event.step === 1));
  assert.ok(events.some(event => event.source === "metronome" && event.step === 0));
  assert.ok(events.some(event => event.source === "a" && event.step === 4));
});

test("muted and empty patterns produce no pattern events", () => {
  const exercise = core.createBlankExercise();
  exercise.metronome = false;
  exercise.patterns[0].muted = true;
  exercise.patterns[1].cells.fill("rest");
  assert.deepEqual(Array.from(core.eventsInRange(exercise, 0, 16)), []);
});
```

- [ ] **Step 2: Run tests and verify scheduling APIs are absent**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: new tests fail because `secondsPerStep` and `eventsInRange` are undefined.

- [ ] **Step 3: Implement deterministic scheduling projections**

Implement `secondsPerStep(bpm) = 60 / bpm / 4`. Implement `eventsInRange` as a pure projection that emits `{source, step, state, instrument}` for non-rest unmuted pattern cells and quarter-note metronome steps (`absoluteStep % 4 === 0`). Keep absolute step numbers in events; let the engine map them into the current cycle.

- [ ] **Step 4: Implement the Web Audio engine**

Create one `AudioEngine` closure with:

- Lazy `AudioContext` creation/resume inside `play()` only.
- Scheduler interval 25 ms and look-ahead horizon 100 ms.
- `nextStep`, `nextNoteTime`, cycle length, and paused position tracked against the audio clock.
- Count-in state of exactly 16 sixteenth steps; click on count-in steps 0, 4, 8, and 12 before pattern events begin.
- Pause clearing the interval and deriving the preserved fractional/current step from audio time.
- Stop clearing the interval, incrementing a generation token so already-scheduled callbacks cannot update UI, and resetting to step zero.
- Cycle wrap at `cycleLength(exercise)`.
- `requestAnimationFrame` visual updates derived from `audioContext.currentTime`, never used to schedule sound.

Implement five short synthesized voices with fresh nodes per hit:

- Kick: sine oscillator dropping approximately 150 Hz → 45 Hz with exponential gain decay.
- Snare: filtered noise burst plus a quiet 180 Hz triangle body.
- Hi-hat: high-pass filtered noise with a short decay.
- Woodblock: two short sine oscillators near 800/1200 Hz.
- Click: very short square oscillator near 1400 Hz.

For accents multiply gain by 1.35 and raise/filter frequency modestly. Route through a conservative master gain to prevent clipping when A, B, and metronome coincide. Catch context creation/resume errors, disable transport audio, and place an actionable message in `status-region` while editing remains available.

- [ ] **Step 5: Integrate transport and verify behavior**

Wire play/pause/stop buttons and keyboard focus labels. Structural edits and exercise loads call `AudioEngine.stop()`; mute and instrument changes update the exercise used by future scheduled hits. Disable Play when model/UI validation errors exist.

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: all tests pass.

Manually test at 60 and 120 BPM: start, pause/resume, stop/reset, loop boundary, one-bar count-in, metronome, simultaneous instruments, accents, changing mute/instrument during playback, and row-following playhead.

- [ ] **Step 6: Commit and push the audio milestone**

```bash
git add polyrhythm/index.html polyrhythm/tests/core.test.mjs
git commit -m "feat: add synthesized look-ahead playback"
git push origin main
```

Expected: commit and push succeed.

---

### Task 6: Drafts, Named Exercises, Presets, and JSON Interchange

**Files:**
- Modify: `polyrhythm/index.html`
- Modify: `polyrhythm/tests/core.test.mjs`
- Modify: `polyrhythm/tests/browser.html` with equivalent browser cases

**Interfaces:**
- Consumes: `validateExercise`, `cloneExercise`, `PRESETS`, controller `setExercise`, and `stopAndReset`.
- Produces: `serializeExercise(exercise)`, `parseExerciseJson(text)`, and private `PersistenceAdapter` methods `loadDraft`, `saveDraft`, `listNamed`, `saveNamed`, `renameNamed`, and `deleteNamed`.
- Storage keys: `polyrhythm:draft:v1` and `polyrhythm:named:v1`.

- [ ] **Step 1: Add failing serialization and failure-preservation tests**

```js
test("exercise JSON round-trips through schema validation", () => {
  const source = core.cloneExercise(core.PRESETS.bleed);
  source.name = "My Bleed Practice";
  const parsed = core.parseExerciseJson(core.serializeExercise(source));
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), JSON.parse(JSON.stringify(source)));
});

test("JSON import rejects unsupported versions and malformed cells", () => {
  const future = core.createBlankExercise();
  future.schemaVersion = 99;
  assert.throws(() => core.parseExerciseJson(JSON.stringify(future)), /schema version/);
  const malformed = core.createBlankExercise();
  malformed.patterns[0].cells[0] = "loud";
  assert.throws(() => core.parseExerciseJson(JSON.stringify(malformed)), /patterns\.0/);
});

test("failed parse does not mutate the caller's current exercise", () => {
  const current = core.createBlankExercise();
  const before = core.serializeExercise(current);
  assert.throws(() => core.parseExerciseJson('{"broken":true}'));
  assert.equal(core.serializeExercise(current), before);
});
```

- [ ] **Step 2: Run tests and verify serialization APIs are missing**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: new tests fail because serialization APIs are undefined.

- [ ] **Step 3: Implement versioned serialization and strict import validation**

Implement `serializeExercise` with two-space indentation and a trailing newline. Implement `parseExerciseJson` to catch JSON syntax errors, reject schema versions other than 1, call `validateExercise`, combine field errors into an actionable message, and return a normalized clone only on complete success. Do not accept extra pattern tracks.

- [ ] **Step 4: Implement local persistence and exercise-management UI**

Implement the adapter around injected `window.localStorage` so failures can be caught. Named storage is a JSON object keyed by generated `crypto.randomUUID()` when available, otherwise timestamp plus random suffix; each entry is `{id, name, updatedAt, exercise}`.

Wire UI for:

- Automatic draft save after every valid state transition.
- Safe startup: parse the draft; if invalid, start blank, leave the original localStorage string untouched, and warn in `status-region`.
- Named save, overwrite, rename, and delete, with confirmation for overwrite/delete.
- Immutable built-in preset choices `Blank`, `Bleed — half-speed herta practice`, and `The Art of Dying`.
- Loading a preset or another exercise: if the current named exercise is dirty, require confirmation; preserve current BPM when loading a built-in preset; stop/reset playback.
- Export through a Blob URL and sanitized filename ending `.polyrhythm.json`; revoke the URL after clicking.
- Import through `<input type="file" accept="application/json,.json">`; parse before state replacement; successful import gets no saved ID and is marked unsaved; failed import leaves state untouched.
- Non-blocking status messages for localStorage quota/security failures.

- [ ] **Step 5: Run tests and manually verify persistence**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: all tests pass.

From a direct `file://` URL, verify draft reload, named create/overwrite/rename/delete, immutable presets, BPM preservation on preset load, export/import round trip, unsupported schema rejection, malformed JSON rejection, and current-state preservation after failure. In DevTools, temporarily replace adapter storage methods with throwing stubs and verify the app remains editable with a warning.

- [ ] **Step 6: Commit and push the persistence milestone**

```bash
git add polyrhythm/index.html polyrhythm/tests/core.test.mjs
git commit -m "feat: add local exercises and JSON interchange"
git push origin main
```

Expected: commit and push succeed.

---

### Task 7: Visual Polish, Cross-Browser Acceptance, and Project Documentation

**Files:**
- Modify: `polyrhythm/index.html`
- Create: `polyrhythm/tests/manual-checklist.md`
- Modify: `README.md`
- Modify: `polyrhythm/tests/core.test.mjs`
- Modify: `polyrhythm/tests/browser.html`

**Interfaces:**
- Consumes: complete app from Tasks 1–6.
- Produces: release-ready standalone app, recorded acceptance evidence, and repository navigation.

- [ ] **Step 1: Add final static completeness tests**

Append a source-level test checking there are no external resources and all required feature labels are present:

```js
test("production app is self-contained and exposes required controls", () => {
  assert.doesNotMatch(html, /<(script|link)[^>]+(?:src|href)=["']https?:/i);
  for (const label of [
    "BPM", "Count-in", "Metronome", "Steps per row", "Independent", "Phrase",
    "Kick", "Snare", "Hi-hat", "Woodblock", "Click",
    "Bleed", "The Art of Dying", "Import", "Export",
  ]) assert.ok(html.includes(label), `missing feature label: ${label}`);
});
```

- [ ] **Step 2: Run the complete automated suite before polish**

Run: `node --test polyrhythm/tests/core.test.mjs`

Expected: all tests pass; if a label differs only in capitalization or accessible wording, update production copy to the exact clear label rather than weakening the test.

- [ ] **Step 3: Complete professional visual and accessibility polish**

Review every screen state and ensure:

- Pattern A orange and Pattern B cyan remain distinguishable by lane labels and hit shapes, not color alone.
- Rest/hit/accent, beat, subgroup, pattern-cycle, shared-cycle, and playhead styles have an explicit visual hierarchy.
- Focus order follows transport → Pattern A → Pattern B → loop controls → exercise controls → comparison.
- Every input has a programmatic label; every icon-only button has an `aria-label`; status/errors use the appropriate live region without interrupting every playhead tick.
- Controls meet a 44 px pointer target where practical on desktop and text/background contrast is readable.
- Reduced-motion users get instant playhead row changes via `@media (prefers-reduced-motion: reduce)`.
- At viewport widths below the fixed music width, controls remain usable and `.music-scroll` scrolls; music columns never reflow.
- A compact explanatory empty state appears before either pattern contains a hit, without treating silence as invalid.

- [ ] **Step 4: Run and record manual acceptance in all supported browsers**

Create `polyrhythm/tests/manual-checklist.md` with a table containing rows for Chrome, Safari, and Firefox and columns for version, `file://` load, editing/keyboard, stable wrapping, audio transport, count-in/metronome, playhead/rows, persistence, JSON, unavailable-audio behavior, and result. Execute every manual acceptance item from SPEC.md §16.2 and record the tested browser version and date rather than using generic checkmarks.

For unavailable audio, use the browser console before reload to deny/simulate `AudioContext` construction where supported, or temporarily run a local working-tree-only replacement; revert any test-only production edit before committing.

- [ ] **Step 5: Update the repository README**

Add a `## Polyrhythm Practice Tool` section after the introduction with:

```markdown
## Polyrhythm Practice Tool

A two-pattern sixteenth-note practice sequencer that visualizes complete realignment cycles, explicit subgrouping, and phrase-based loops.

**▶ [Run it in your browser](https://jarredbarber.github.io/math-art/polyrhythm/)**

Features:
- Two editable patterns with normal and accented hits
- Complete LCM-cycle and custom phrase visualization
- Synthesized Web Audio playback, metronome, and count-in
- Built-in Bleed and The Art of Dying practice presets
- Named local exercises and JSON import/export
```

- [ ] **Step 6: Run final verification**

Run:

```bash
node --test polyrhythm/tests/core.test.mjs
git diff --check
git status --short
```

Then run `python3 -m http.server 8000`, open `http://localhost:8000/polyrhythm/tests/browser.html` in each supported browser, and verify its visible result reports the same test count with 0 failures.

Expected: CLI and browser harness tests pass, `git diff --check` prints nothing, and status lists only the intended `index.html`, browser/CLI tests, checklist, and README changes.

Open `polyrhythm/index.html` directly one final time and execute the two preset acceptance paths: Bleed must show 48 comparison steps with A hits at 1/9 and B hits at 1/2/3/5; Art of Dying must show 180 steps with the exact 45-step grouping and silent Pattern B.

- [ ] **Step 7: Commit and push the release milestone**

```bash
git add README.md polyrhythm/index.html polyrhythm/tests/core.test.mjs polyrhythm/tests/browser.html polyrhythm/tests/manual-checklist.md
git commit -m "feat: complete polyrhythm practice tool"
git push origin main
```

Expected: commit and push succeed and GitHub Pages serves `/polyrhythm/` after deployment.
