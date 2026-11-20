# Cath Lab Run

A diagnostic coronary angiography game with fictional patients. Drive a Judkins catheter from the femoral artery to the aortic root, engage each coronary ostium, record cine runs in standard C-arm projections, then mark and grade the stenosis. Keep contrast and radiation low.

**Play it:** https://brendanjvr-ux.github.io/cath-lab-run/ (tests at [/tests/tests.html](https://brendanjvr-ux.github.io/cath-lab-run/tests/tests.html))

Plain HTML, CSS and JavaScript with Canvas 2D: no build step and no image assets. Fonts load from Google Fonts.

## Run it locally

```bash
python3 -m http.server 8767
```

Then open http://localhost:8767/ (the game) or http://localhost:8767/tests/tests.html (the automated tests). You can also double-click `index.html`.

## Files

| File | What it is |
|---|---|
| `cases/*.js` | **Editable case files**: patient, history, task, contrast budget, and each lesion's vessel, position, length, severity and eccentricity. |
| `config/config.js` | Anatomy (coronary tree, aorta), coronary flow speed, the Judkins catheters' engagement windows, C-arm presets and grading buckets. |
| `js/sim.js` | Geometry, catheter position and engagement, lesion appearance per projection, and the X-ray image renderer. No game state. |
| `js/game.js` | Game state, controls, cine runs and review, the ECG and pressure strip, the main loop and scoring. |
| `css/style.css` | Layout and look. |
| `tests/tests.html` | Automated checks: cases load, catheter engagement and deep-seating, eccentric lesions per view, contrast rendering. |

To add a case, copy a file in `cases/`, edit it, and add a `<script>` line for it in `index.html` and `tests/tests.html`.

## How it plays

| Step | What you do |
|---|---|
| Access | Start with a 6F JL4 catheter in the femoral sheath. Hold fluoro and advance up the descending aorta, over the arch, into the aortic root. |
| Engage | Torque the tip into the ostium: JL4 for the left main, JR4 (a big clockwise turn) for the RCA. Exchange catheters in the descending aorta. A test puff shows where you are. |
| Watch the pressure | Advance too far and the aortic trace damps. Injecting through a damped catheter causes an ostial dissection and ends the case. |
| Record | Start a cine run, then inject. Contrast flows down the tree and washes out; flow beyond a severe stenosis is slow. RCA injections can cause brief bradycardia. |
| Choose views | The C-arm rotates in 3D (LAO/RAO, cranial/caudal). Some lesions are eccentric, so they look tight in one projection and mild in another. |
| Report | Replay a run, click the narrowing, grade it (<50%, 50–69%, 70–89%, ≥90%), then finish the study. |

## Cases

1. **Exertional chest pain** (M, 64): proximal LAD stenosis.
2. **Inferior NSTEMI** (F, 58): tight mid RCA lesion with sluggish distal flow.
3. **Breathless on exertion** (M, 71): circumflex disease plus a mild LAD lesion, with a 50 mL contrast budget.

## Scoring (out of 100)

| Part | Points |
|---|---|
| Lesion detection and grading | 40 |
| Complete study (LCA in 3+ views, RCA in 2+) | 20 |
| Contrast against the case budget | 15 |
| Air kerma (full marks up to 300 mGy) | 15 |
| Safety (catheter moved only under fluoro) | 10 |

A complication caps the score at 35. The report says which projection showed each lesion best.

## Controls

Space hold fluoro · C start/stop cine · J hold to inject · ↑/↓ advance/withdraw · ←/→ torque counter-clockwise/clockwise · 1–7 C-arm presets. Touch devices use the on-screen buttons.

Teaching game with simplified anatomy and physics. Not a clinical training device.
