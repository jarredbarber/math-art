# Accent Instruments and Stable Text Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let accent cells replace a pattern’s normal sound with a selected accent instrument, while text inputs retain focus during multi-character entry.

**Architecture:** Extend the existing single-file `polyrhythm/index.html` model with an `accentInstrument` string for each pattern. The pure scheduler chooses it for accent events. UI text handlers mutate state and save drafts without calling global `render()`; structural actions retain the existing render path.

**Tech Stack:** Dependency-free HTML/CSS/JavaScript, Web Audio API, Node built-in test runner, localStorage.

## Global Constraints

- Keep the app a single local-loadable `polyrhythm/index.html`; add no runtime dependencies or build step.
- Keep patterns monophonic: an accent replaces, rather than layers over, the normal instrument.
- Preserve JSON/localStorage compatibility by treating absent `accentInstrument` as `instrument`.
- Preserve user-entered BPM, pattern name, and grouping text focus while typing.
- Update the built-in Bleed preset to 32 sixteenth-note cells with hi-hat hits at 1, 9, 17, and 25; step 17 is an accented snare.
- Run `node --test tests/core.test.mjs`, `node --check` on the extracted core script, and `git diff --check` before committing.

---

### Task 1: Extend the pattern model and playback events

**Files:**
- Modify: `polyrhythm/tests/core.test.mjs`
- Modify: `polyrhythm/index.html`
- Test: `polyrhythm/tests/browser.html`

**Interfaces:**
- Consumes: `pattern`, `blankExercise`, `validateExercise`, `normalizeImportedExercise`, `eventsInRange`.
- Produces: patterns with `accentInstrument: InstrumentName`; accent events whose `instrument` equals `accentInstrument`.

- [ ] **Step 1: Write failing model and scheduler tests**

```js
const p = pattern(2, ["hit", "accent"]);
p.instrument = "kick";
p.accentInstrument = "snare";
const events = core.eventsInRange({ patterns: [p, pattern(2)], loopMode: "independent", bpm: 120 }, 0, 0.5);
assert.equal(events.find((event) => event.state === "hit").instrument, "kick");
assert.equal(events.find((event) => event.state === "accent").instrument, "snare");

const legacy = core.normalizeImportedExercise({ ...core.blankExercise(), patterns: [{ ...p, accentInstrument: undefined }, pattern(2)] });
assert.equal(legacy.patterns[0].accentInstrument, legacy.patterns[0].instrument);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/core.test.mjs`

Expected: FAIL because no pattern default/normalization or scheduler selection exists for `accentInstrument`.

- [ ] **Step 3: Implement model, compatibility, validation, and event selection**

```js
function defaultPattern(name, color, instrument) {
  return { name, color, length: 16, cells: Array(16).fill(CELL.REST), grouping: [], instrument, accentInstrument: instrument, muted: false };
}

function normalizePattern(raw) {
  const instrument = raw.instrument;
  return { ...raw, instrument, accentInstrument: raw.accentInstrument ?? instrument };
}

// In validatePattern, require INSTRUMENTS.includes(pattern.accentInstrument).
// In eventsInRange, set instrument to state === CELL.ACCENT ? pattern.accentInstrument : pattern.instrument.
```

Keep the existing accent gain/timbre treatment only when `accentInstrument === instrument`; an alternate instrument must be heard as its own synthesized voice.

- [ ] **Step 4: Update the browser harness**

Add the same scheduler and legacy-normalization assertions to `tests/browser.html`; report them using its existing pass/fail helper.

- [ ] **Step 5: Run verification**

Run: `node --test tests/core.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/core.test.mjs tests/browser.html
git commit -m "feat: support alternate accent instruments"
```

### Task 2: Add accent-instrument editing and repair text-input rendering

**Files:**
- Modify: `polyrhythm/tests/core.test.mjs`
- Modify: `polyrhythm/tests/browser.html`
- Modify: `polyrhythm/index.html`

**Interfaces:**
- Consumes: each pattern’s `instrument` and `accentInstrument`; existing `renderPatternEditor`, draft persistence, and status controls.
- Produces: one normal Instrument and one Accent instrument select per pattern; input listeners that retain their DOM nodes.

- [ ] **Step 1: Write failing source-contract test**

```js
assert.match(html, /Accent instrument/);
assert.match(html, /accentInstrument/);
assert.match(html, /updateTextField/);
```

Add a `tests/browser.html` assertion that the rendered DOM has two `select` elements labelled `Instrument` and `Accent instrument` for each pattern.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/core.test.mjs`

Expected: FAIL because the selector/handler contract is absent.

- [ ] **Step 3: Render and wire the Accent instrument selector**

```js
<label>Accent instrument
  <select data-pattern-accent-instrument="${index}">${instrumentOptions(pattern.accentInstrument)}</select>
</label>
```

On `change`, set `pattern.accentInstrument`, call `saveDraft()`, and call `render()` so comparison and editor state remain synchronized. Do not alter normal-instrument behavior.

- [ ] **Step 4: Replace text-input full rerenders**

```js
function updateTextField(target, update) {
  update(target.value);
  saveDraft();
}

bpmInput.addEventListener("input", (event) => updateTextField(event.currentTarget, (value) => {
  state.exercise.bpm = value;
}));
```

Use this pattern for BPM, each pattern name, and grouping. Validate/render the timeline on `change` or `blur` for grouping, and use the current input value in any inline validation message. Never invoke global `render()` from these text-field `input` listeners. Keep length, select, checkbox, preset, import, and save actions on their current structural render paths.

- [ ] **Step 5: Update the browser harness**

In `tests/browser.html`, focus the rendered BPM input, set a multi-character value through input events, and assert `document.activeElement === bpmInput` after each event and that the state contains the full string. Repeat for a pattern-name input.

- [ ] **Step 6: Run verification**

Run: `node --test tests/core.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/core.test.mjs tests/browser.html
git commit -m "fix: preserve focus while editing polyrhythm fields"
```

### Task 3: Revise Bleed and documentation, then verify delivery

**Files:**
- Modify: `polyrhythm/tests/core.test.mjs`
- Modify: `polyrhythm/index.html`
- Modify: `polyrhythm/SPEC.md`
- Modify: `polyrhythm/README.md`

**Interfaces:**
- Consumes: `PRESETS.BLEED`, UI accent selection, event scheduler.
- Produces: documented 32-step Bleed exercise with hi-hat normal hits and accented snare at step 17.

- [ ] **Step 1: Write the failing preset test**

```js
const bleed = core.PRESETS.BLEED;
assert.equal(bleed.patterns[0].length, 32);
assert.equal(bleed.patterns[0].instrument, "hat");
assert.equal(bleed.patterns[0].accentInstrument, "snare");
assert.deepEqual(activeSteps(bleed.patterns[0]), [1, 9, 17, 25]);
assert.equal(bleed.patterns[0].cells[16], "accent");
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test tests/core.test.mjs`

Expected: FAIL because the old 16-step Bleed reference pattern is still present.

- [ ] **Step 3: Implement exact preset and documentation changes**

```js
patterns: [
  { ...defaultPattern("Half-note reference", "#f59e0b", "hat"), length: 32,
    cells: ["hit", ...Array(7).fill("rest"), "hit", ...Array(7).fill("rest"), "accent", ...Array(7).fill("rest"), "hit", ...Array(7).fill("rest")],
    accentInstrument: "snare" },
  // retain the existing six-cell, unaccented herta pattern
]
```

Update `SPEC.md` and `README.md` to state that accents can replace the primary sound and document the revised Bleed steps.

- [ ] **Step 4: Run complete verification**

Run:

```bash
node --test tests/core.test.mjs
node - <<'NODE'
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync('/tmp/polyrhythm-core-check.mjs', html.match(/<script id="polyrhythm-core">([\s\S]*?)<\/script>/)[1]);
NODE
node --check /tmp/polyrhythm-core-check.mjs
git diff --check
```

Expected: all tests pass; syntax checker and diff checker exit 0.

- [ ] **Step 5: Commit and push**

```bash
git add index.html tests/core.test.mjs SPEC.md README.md
git commit -m "fix: revise Bleed accent practice pattern"
git push origin main
```
