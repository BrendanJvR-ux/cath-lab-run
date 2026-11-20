# Cath Lab Run

A coronary angiography and stenting game with fictional patients. Drive a Judkins catheter from the femoral artery to the aortic root, engage each coronary ostium, record cine runs in standard C-arm projections, mark and grade the stenosis, then stent it. Keep contrast and radiation low.

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
| `config/config.js` | Anatomy (coronary tree, aorta), coronary flow speed, the Judkins catheters' engagement windows, C-arm presets, grading buckets and stent sizes. |
| `js/sim.js` | Geometry, catheter position and engagement, lesion appearance per projection, stent outcome rules, and the X-ray image renderer (including wire, balloon and stent struts). No game state. |
| `js/game.js` | Game state, controls, cine runs and review, the stenting procedure, the ECG and pressure strip, the main loop and scoring. |
| `css/style.css` | Layout and look. |
| `tests/tests.html` | Automated checks: cases load, catheter engagement and deep-seating, eccentric lesions per view, contrast rendering, stent sizing and coverage. |

To add a case, copy a file in `cases/`, edit it, and add a `<script>` line for it in `index.html` and `tests/tests.html`.

## How it plays

| Step | What you do |
|---|---|
| Access | Start with a 6F JL4 catheter in the femoral sheath. Hold fluoro and advance up the descending aorta, over the arch, into the aortic root. |
| Engage | Torque the tip into the ostium: JL4 for the left main, JR4 (a clockwise turn) for the RCA. Near an ostium the tip drops in on its own. Exchange catheters in the descending aorta. |
| Watch the pressure | Advance too far and the aortic trace damps. Injecting through a damped catheter causes an ostial dissection and ends the case. |
| Record | Start a cine run, then inject. Contrast flows down the tree and washes out; flow beyond a severe stenosis is slow. RCA injections can cause brief bradycardia. |
| Choose views | The C-arm rotates in 3D (LAO/RAO, cranial/caudal). Some lesions are eccentric, so they look tight in one projection and mild in another. |
| Report | Replay a run, click the narrowing and grade it (<50%, 50–69%, 70–89%, ≥90%). |
| Stent | With the guide engaged, press Stent next to a marked lesion. Cross it with a wire under fluoro, pick a diameter and length (the 6F guide is 2 mm wide for scale), nudge the markers around the narrowing, then hold Inflate to deploy at 12–14 atm. The balloon causes chest pain and ST elevation while it's up. Take a final shot, remove the wire, finish. |

## Cases

1. **Exertional chest pain** (M, 64): proximal LAD stenosis.
2. **Inferior NSTEMI** (F, 58): tight mid RCA lesion with sluggish distal flow.
3. **Breathless on exertion** (M, 71): circumflex disease plus a mild LAD lesion, with a 50 mL contrast budget.

## Scoring (out of 100)

| Part | Points |
|---|---|
| Lesion detection and grading | 35 |
| Treatment: every ≥70% lesion stented, covered, sized within 0.4 mm smaller / 0.75 mm larger than the vessel, deployed at ≥12 atm (−8 per unnecessary stent) | 15 |
| Complete study (LCA in 3+ views, RCA in 2+) | 15 |
| Contrast against the case budget | 15 |
| Air kerma (full marks up to 400 mGy) | 10 |
| Safety (catheter moved only under fluoro) | 10 |

A complication caps the score at 35. The report says which projection showed each lesion best.

## Controls

Space hold fluoro · C start/stop cine · J hold to inject · ↑/↓ advance/withdraw · ←/→ torque counter-clockwise/clockwise · B hold to inflate the stent balloon · 1–7 C-arm presets. Touch devices use the on-screen buttons.

Teaching game with simplified anatomy and physics. Not a clinical training device.
