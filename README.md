# Cath Lab Run

A coronary angiography and stenting game with fictional patients. Drive a Judkins catheter from the femoral artery to the aortic root, engage each coronary ostium, record cine runs in standard C-arm projections, mark and grade the stenosis, then stent it. Keep contrast and radiation low.

**Play it:** https://brendanjvr-ux.github.io/cath-lab-run/ (tests at [/tests/tests.html](https://brendanjvr-ux.github.io/cath-lab-run/tests/tests.html))

Plain HTML, CSS and JavaScript with Canvas 2D: no build step. Drawn in a hand-drawn sketchbook style: ink and coloured pencil on paper, the X-ray as pencil anatomy with inked, cross-hatched shading and contrast that fills the vessels like an ink wash (the pen lines "boil" gently like hand-drawn animation), and the ECG on pink ECG paper. A very faint pencil sketch of the heart sits where the heart really is in every projection, following standard radiographic cardiac anatomy: the SVC and right atrium form the right border; the aortic knob, main pulmonary artery, left atrial appendage and left ventricle form the left border; the right ventricle lies in front and the left atrium behind. The ventricles are fitted to the patient's own coronary tree. Easy shows the chambers (RA, RV, LA, LV), the grooves, the great cardiac vein and coronary sinus, the great vessels including the three arch branches, and labels; Medium shows only the cardiac outline; Hard shows none. The only image file is the menu picture of two cardiologists (`assets/cardiologists.png`), rendered in Blender (cel shading with Freestyle ink outlines) by `tools/render_cardiologists.py`: run `/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/render_cardiologists.py -- assets` from the repo root to re-render it. Fonts (Kalam, Patrick Hand) load from Google Fonts.

## Run it locally

```bash
python3 -m http.server 8767
```

Then open http://localhost:8767/ (the game) or http://localhost:8767/tests/tests.html (the automated tests). You can also double-click `index.html`.

## Files

| File | What it is |
|---|---|
| `config/config.js` | Anatomy (coronary tree, aorta), coronary flow speed, Judkins catheters, C-arm presets, grading buckets, stent and balloon sizes, difficulty settings, ECG territories and avatars. |
| `js/gen.js` | Random patients: case codes, anatomy variants, lesions, a matching history, and each case's complications for the chosen difficulty (`caseChallenge`). |
| `js/sim.js` | Geometry, anatomy builder (variants), catheter position and engagement, lesion appearance per projection, stent and balloon outcome rules, coverage segments, coronary tortuosity, ribs and spine, and the X-ray image renderer (including wire, balloon and stent struts). No game state. |
| `js/game.js` | Menu, operator profile and coffee tokens, game state, controls, cine runs and review, the PCI tools, the three-lead ECG and pressure strip, the main loop and scoring. |
| `css/style.css` | Layout and look. |
| `tools/render_cardiologists.py` | Blender script that renders the menu picture `assets/cardiologists.png`. |
| `tests/tests.html` | Automated checks: cases load, catheter engagement, a smooth aorta-to-root path and deep-seating, eccentric lesions per view, contrast rendering, stent and balloon rules, difficulty windows, shop items, ECG territories, coronary tortuosity, coverage segments, and 400 random patients (valid anatomy, stentable culprit, engageable ostia, same code gives the same patient). |

## Menu, operators and coffee tokens

Create an operator (name and one of six avatars), then pick a difficulty and a case. Each report pays coffee tokens: one per 10 points, ×1.5 on Medium and ×2 on Hard, none after a complication. Tokens, purchases and your best score per case and difficulty are saved in this browser (`localStorage`).

### Coffee cart (shop)

| Item (tokens) | Effect |
|---|---|
| Power injector (tiers I–III: 20 / 40 / 70) | Contrast budget +15% / +30% / +50%: about +10 / +21 / +35 mL on a typical 70 mL case |
| Fluoro budget (tiers I–III: 20 / 40 / 70) | Full radiation marks up to 500 / 650 / 850 mGy air kerma instead of 400 |
| Torque device (tiers I–III: 20 / 40 / 70) | Every engagement window 4° / 8° / 12° wider |
| Hydrophilic wire (15) | Crosses lesions twice as fast, but exits small vessels a little more often |
| Three extra avatars (15 each) | Pick them in Change operator |

Upgrades are `UPGRADES` and other items `SHOP` in `config/config.js`. Old single-tier perks carry over as tier I. The old monitor colour filters were retired; anyone who bought one gets the tokens back when their profile loads.

| Difficulty | Engagement window (left / right) | Help finding the ostia | Contrast budget | Extras |
|---|---|---|---|---|
| Easy | 45° / 55° | Tip drops in from up to 70° further | No limit | |
| Medium | 28° / 32° | Gentle pull | ×1 | Tokens ×1.5 |
| Hard | 16° / 18° | None, and the catheter damps sooner | ×0.75 | Tokens ×2 |

## How it plays

| Step | What you do |
|---|---|
| Access | Start with a 6F JL4 catheter in the femoral sheath. Hold fluoro and advance up the descending aorta, over the arch, into the aortic root. |
| Engage | Torque the tip into the ostium: JL4 for the left main, JR4 (a clockwise turn) for the RCA. Near an ostium the tip drops in on its own. Switch between JL4 and JR4 with the catheter toggle (or X) from anywhere outside an ostium; it backs out of an engaged ostium first. |
| Watch the pressure | Advance too far and the aortic trace damps. Injecting through a damped catheter causes an ostial dissection and ends the case. |
| Record | Start a cine run, then inject. Contrast flows down the tree and washes out; flow beyond a severe stenosis is slow. RCA injections can cause brief bradycardia. |
| Choose views | The C-arm rotates in 3D (LAO/RAO, cranial/caudal). Some lesions are eccentric, so they look tight in one projection and mild in another. |
| Report | Replay a run, click the narrowing and grade it (<50%, 50–69%, 70–89%, ≥90%). |
| Wire | With the guide engaged, press Wire it next to a marked lesion and hold fluoro while a 0.014" wire crosses. |
| Balloon | Plain balloon angioplasty: 8–12 atm. Alone it recoils to about 30–45%. Use it to predilate a subtotal (≥90%) lesion before stenting, or to post-dilate a stent. Oversizing by more than 0.5 mm causes a dissection. |
| Stent | Pick a diameter and length. Sizing help: on Easy the panel shows the vessel's size and the narrowing's length and stars the best-fitting device; on Medium a size range (compared with the 2 mm guide) and a rough length; on Hard the rules only (stent 1:1 with the vessel and 2–3 mm longer than the narrowing each side; predilating balloon 0.5 mm smaller; post-dilating balloon the stent's size or up to 0.5 mm bigger). For scale, the 6F guide is 2 mm wide. nudge the markers around the narrowing, then hold Inflate to deploy at 12–14 atm (pressure rises about 2.8 atm a second, so 12 atm takes about 4 s). Take a final shot, remove the wire, finish. |
| Complications | **Dissection**: an oversized balloon or stent, inflating above 16 atm, or (occasionally) balloon angioplasty of a hard lesion or a stent edge can tear the vessel wall. It shows as a flap, a second channel of contrast beside the lumen and staining that lingers after the injection. Left alone it narrows and then closes the vessel (Easy 80 s, Medium 55 s, Hard 35 s): cover it with a stent (**Aim devices here**, or **Wire it** again if the wire is out). **No-reflow**: after a stent, more often in an NSTEMI, a subtotal lesion or a long stent, the stent stays open but contrast crawls beyond it. Give intracoronary **verapamil** or **adenosine** through the engaged guide until flow is brisk; GTN does little. Both start with chest pain, ST elevation in the territory lead and falling blood pressure, and are only named once you inject and see them. |
| Perforation and tamponade | **Perforation**: a balloon or stent more than 1 mm too big, or inflated above 16 atm, can tear right through the vessel: a jet of contrast squirts out and pools beside the heart. A wire can also exit the tip of a small distal vessel (hydrophilic wires do this more often). Blood fills the pericardium: an untreated big hole tamponades in about 36 s (BP collapses with a narrow pulse pressure, HR races) and a cardiac arrest ends the case. Seal a big hole with a **covered stent**; a distal wire exit with a **coil** or a 15 s low-pressure balloon inflation (**Aim devices here** caps the balloon at 6 atm and stops the leak while held). **IV protamine** slows the leak; **Pericardiocentesis** drains the effusion and restores BP, but it reaccumulates until the hole is sealed. |
| Spasm | Engaging an ostium (the RCA more than the left), deep-seating the catheter, or passing the wire can cause **spasm**: a smooth, concentric narrowing that looks the same in every view. Tight spasm causes chest pain and ST elevation. **Intracoronary GTN** relieves it (verapamil partly, adenosine not); it also settles by itself once the catheter or wire is gone. Don't grade or stent it: a mark or stent on spasm is penalised. On Easy the panel names it once imaged; on Medium and Hard only tight, symptomatic spasm gets an alert. |
| ECG | Three leads follow the coronary territories: V3 anterior (LAD), V5 lateral (circumflex), II inferior (RCA). An inflated balloon raises ST in that territory's lead with reciprocal depression elsewhere. Patients with an NSTEMI start with T-wave inversion in the lead facing the culprit vessel. |

## Random patients

Every case is a random patient. **New random patient** builds a fresh one from a seed, shown as a case code such as `CLR-BNF2J`. The same code always gives the same patient, so you can replay it or send it to a friend (type it into the box next to the button).

Each patient gets:

| Part | What varies |
|---|---|
| Dominance | Right (about 78%), left (11%: the circumflex wraps round to the crux and gives the PDA, the RCA is small) or co-dominant (11%: the circumflex gives a posterolateral branch, the RCA keeps the PDA) |
| Branches | Ramus intermedius (20%), short left main (12%), large or small first diagonal, one or two obtuse marginals |
| RCA origin | Usual, anterior, or posterior (needs more clockwise torque) |
| Tortuosity | Its own pattern and strength of natural vessel bends |
| Disease | One or two significant lesions (70–96%) in a vessel big enough to stent, plus up to two mild or intermediate decoys you should report but not stent |
| Story | Age, sex, risk factors, stable angina or NSTEMI with a stress test or ECG that matches the culprit's territory, and sometimes impaired kidneys with a tighter contrast budget |

The report names the anatomy at the end. Your best score is kept per difficulty.

### Today's case and medals

The main menu has **Today's case**: one patient a day, the same for everyone (the code comes from the date). Play it as often as you like; your best result of the day counts. Medals depend on the difficulty you play it on:

| Difficulty | Bronze | Silver | Gold |
|---|---|---|---|
| Easy | 65 | 80 | 92 |
| Medium | 58 | 72 | 85 |
| Hard | 50 | 65 | 78 |

A medal pays bonus tokens (bronze 5, silver 10, gold 20; improving a medal on the same day pays the difference). A medal on consecutive days builds a streak. The medal cabinet on the menu counts them.

### What goes wrong, by difficulty

| Difficulty | Complications |
|---|---|
| Easy | None: oversizing or a damped injection only earns a warning |
| Medium | About a third of cases are complication-prone (more chance complications, some with a set complication waiting); the rest only go wrong if you cause it |
| Hard | About 9 in 10 cases bring a set complication (dissection, no-reflow, perforation or spasm), a severe contrast restriction (half the budget, severe kidney disease), or both |

The same case code on the same difficulty always brings the same challenge. The generator is `js/gen.js`; the variants are `VARIANT_PARTS` in `config/config.js`.

## Scoring (out of 100)

| Part | Points |
|---|---|
| Lesion detection and grading (a significant lesion you imaged but didn't mark earns 30% of its share) | 35 |
| Treatment (itemised in the report: each lesion's share, every deduction with the size that would have fitted, and each penalty): every ≥70% lesion stented, complications recognised and managed (−6 untreated dissection, −5 persistent no-reflow, −8 and a score cap of 45 for an unsealed perforation, −10 and the same cap for a vessel left closed, −3 for protamine with nothing bleeding), covered, sized within 0.4 mm smaller / 0.75 mm larger than the vessel, deployed at ≥12 atm, subtotal lesions predilated. Balloon only earns 40%. −8 per unnecessary stent, −4 per oversized or unnecessary balloon | 15 |
| Complete study: views (LCA 3+, RCA 2+) up to 8, plus up to 7 for the share of the 36 coronary segments you opacified | 15 |
| Contrast against the case budget | 15 |
| Air kerma (full marks up to 400 mGy, more with the fluoro budget upgrade) | 10 |
| Safety (catheter moved only under fluoro) | 10 |

A complication caps the score at 35. The report says which projection showed each lesion best, and estimates the flow in each diseased vessel before and after: maximal flow as a share of normal (roughly what an FFR wire would read), the FFR itself and the TIMI grade, taking lesions in series and any complication left at the end into account.

## Controls

Space hold fluoro · X switch catheter · C start/stop cine · J hold to inject · ↑/↓ advance/withdraw · ←/→ torque counter-clockwise/clockwise · B hold to inflate a balloon or stent · 1–7 C-arm presets. Touch devices use the on-screen buttons.

Teaching game with simplified anatomy and physics. Not a clinical training device.
