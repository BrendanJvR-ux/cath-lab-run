# Cath Lab Run

A coronary angiography and stenting game with fictional patients. Drive a Judkins catheter from the femoral artery to the aortic root, engage each coronary ostium, record cine runs in standard C-arm projections, mark and grade the stenosis, then stent it. Keep contrast and radiation low.

**Play it:** https://brendanjvr-ux.github.io/cath-lab-run/ (tests at [/tests/tests.html](https://brendanjvr-ux.github.io/cath-lab-run/tests/tests.html))

Plain HTML, CSS and JavaScript with Canvas 2D (plus three.js for the optional 3D heart view): no build step. Drawn in a pen-and-ink style: cream paper and iron-gall ink, old-style serif lettering (IM Fell English for headings and buttons, Cormorant Garamond for text), engraved double-ruled frames, buttons as oval plaques, the inject control and messages as ink ribbons (messages and warnings sit in their own bar just under the X-ray, never over the image), and one oxblood-ink accent for anything live or marked. The X-ray background is engraved: hatching laid over the anatomy, denser and cross-hatched where it is darker (drawn once per view and cached), with the vessels in solid ink and your marks as double oxblood rings. The ECG runs on a faint sepia grid. The main menu picture is an ink drawing of a heart that grows roots, watched over by a small figure paying out the catheter (`assets/heart-tree.png`, drawn in code by `tools/render_heart_tree.html`). A very faint line drawing of the heart sits where the heart really is in every projection, following standard radiographic cardiac anatomy: the SVC and right atrium form the right border; the aortic knob, main pulmonary artery, left atrial appendage and left ventricle form the left border; the right ventricle lies in front and the left atrium behind. The ventricles are fitted to the patient's own coronary tree. Easy shows the chambers (RA, RV, LA, LV), the grooves, the great cardiac vein and coronary sinus, the great vessels including the three arch branches, and labels; Medium shows only the cardiac outline; Hard shows none. Besides the heart picture, the image files are the stroke room's skull X-ray (`assets/skull-xray.png`, see the stroke room below) and the menu picture of two cardiologists (`assets/cardiologists.png`), rendered in Blender (cel shading with Freestyle ink outlines) by `tools/render_cardiologists.py`: run `/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/render_cardiologists.py -- assets` from the repo root to re-render it. The fonts (IM Fell English, Cormorant Garamond) load from Google Fonts. Scripts and the stylesheet are linked from `index.html` with a `?v=` date, and the skull image from `js/stroke.js` with its own `?v=`: change them when you publish so browsers fetch the new files instead of old cached ones.

## Look

The **menus and controls** follow the same pen-and-ink style: italic old-style headings, paper panels with engraved double rules, and oval plaque buttons (solid ink for the main action). The **main menu** puts the title and **Start case** first, with **Case select** as the secondary action. **Case select** shows patients as folders (today's case, an unfinished case, four waiting patients, your career case, the tutorial); selecting one opens its chart (history and task) with **Start case**; arrow keys move between folders. In a case, a **control strip** sits on the monitor's lower edge: buttons to turn the catheter, Advance and Withdraw, Fluoro and Record, and a broad **Hold to inject** that stops on release, when the pointer leaves it, if the touch is cancelled or when the window loses focus. Each button shows the input it is bound to on desktop; the hints hide on touchscreens. The operator button in the header returns to the menu at any time; a case in progress is saved and resumable.

## The stroke room: mechanical thrombectomy

A second procedure with the same controls, scoring style and progression, in a different organ system (`js/stroke-sim.js` for the anatomy, steering and dye, with no page code so the tests load it; `js/stroke.js` for the room). Open it from **Stroke room** on the main menu or the folder in case select.

- **Anatomy:** the aortic arch (type I, II or III, sometimes a bovine arch where the left carotid comes off the first branch), subclavian, common, internal and external carotid and vertebral arteries, and the arteries of the brain (M1 and its two M2 branches, A1 and the anterior cerebral, the basilar and posterior cerebrals). Two views at once, front and side, as in a neuro room's biplane, with the same X-ray look as the heart room: bone drawn as density in graphite and engraved with hatching where it is densest, arteries and catheter multiplied over it (pen edges, a darker core, radio-opaque tip and stent markers), film grain and the dark rim of the field. The head, neck and upper chest are an X-ray of a 3D model (see Skull and neck below).
- **Steering:** the same keys. The tip enters a branch when you are at its opening and the tip is turned its way (the external carotid is a trap: it goes to the face). The guide catheter stops at the skull base; **X** sends the microcatheter on into the head (and it comes back into the guide when you pull back to the neck). On Story and Easy the tip is drawn towards the right opening and a guide under the X-ray says what to do next.
- **Dye and the venous phase:** as in the heart room, dye builds up at the catheter tip while J is held, flows down the arteries with the blood (nearer branches first, the farthest within about a second and a half) and washes out slowly after you let go. Dye that reached the brain drains about three seconds later through the cortical veins, the sagittal, straight, transverse and sigmoid sinuses and the jugular veins, then fades.
- **Vessels:** the internal carotid with its petrous bend and cavernous siphon, the ophthalmic artery, the middle cerebral (M1 with small perforators, two M2 trunks fanning into frontal, parietal, temporal and angular branches), the anterior cerebral arching over the corpus callosum with its callosomarginal branch, the posterior and superior cerebellar arteries off the basilar, the vertebral loop round the atlas, and the external carotid's facial, occipital, superficial temporal and maxillary branches. Small branches fill with dye but are not for the catheter.
- **Skull and neck:** an X-ray of a 3D model, not a flat drawing. `tools/skull-model.js` builds the skull, face, jaw, teeth, cervical and upper thoracic spine, ribs, clavicles, shoulder blades and upper arms out of signed-distance shapes in the same coordinates as the arteries, and passes rays through it in both views, so bone that a ray crosses edge-on (the vault's tables, the orbital roofs, the cortex of the spine) comes out dense, overlaps add up, and both views always agree. The model has a vault with outer and inner tables and a speckled diploe between them, sutures (coronal, sagittal, lambdoid, squamosal), middle meningeal grooves and granulation pits; a skull base stepped into the anterior, middle and posterior fossae (domed orbital roofs, the cribriform dip, bowls under the temporal lobes and cerebellum), the sphenoid body with its sinus and the sella, dorsum and clinoids, the clivus, petrous ridges with the ear canal, internal auditory canal and inner ear, honeycombed mastoids and ethmoid cells, styloids, occipital condyles, the foramen magnum and the occipital protuberances; tilted orbital rims, brow ridges, cheekbones and zygomatic arches, the maxilla with its sinuses, nasal cavity, septum and turbinates, nasal bones, hard palate and pterygoid plates; a mandible with chin, body, angle, ramus, coronoid and condyle and its canal; 32 teeth with crowns, roots (two on the molars) and pulp; the hyoid; C1 to C7 and T1 to T6 with bodies, pedicles, articular pillars, laminae, transverse processes (with the vertebral artery's foramina in the neck) and spinous processes; and soft tissue with the airway and sinuses as holes. `tools/render_skull.html` renders it into `assets/skull-xray.png` (bone, ink contours and soft tissue in the red, green and blue channels); the game engraves that at run time: a graphite wash, line screens that thicken with density and cross where it is denser, and inked contours. To re-render: run `python3 tools/serve.py` from the repo root, open `http://127.0.0.1:8767/tools/render_skull.html` and press Save (about two minutes).
- **Finding the clot:** record a film (C) while injecting dye (J). The dye column stops at the clot. Open the film, click where the dye stops, and say which segment it is (internal carotid terminus, M1, M2 or basilar). A roadmap (a faint ghost of the last film) helps steering; it is on by default on Story and Easy.
- **Zoom:** Z (or the panel button) magnifies both views ×1.8 on the head, drawn from a sharper bone image. It switches on by itself when the thin tube first goes out, unless you have already chosen; clicking a zoomed film still marks the clot.
- **Taking it out:** cross the clot with the microcatheter for a **stent retriever** (hold B to open it, let it grip for 3–6 seconds, then hold B to pull back with suction), or stop with the tip on the clot face for **aspiration** (hold B for suction). Each pass can fail; a fragment can break off into an M2 branch; pushing the microcatheter against the end of a small artery can cause a brain bleed on Medium and Hard. A control run shows the result as a TICI grade.
- **The clock:** door-to-reperfusion time runs throughout (faster on harder settings), NIHSS worsens as time passes, and the panel shows how much brain can still be saved.
- **Score (100):** reperfusion (TICI 3 40, 2b 32, 2a 12), speed from groin puncture to reperfusion (20), finding and naming the occlusion (15), passes with a first-pass bonus (10), safety and dose (15; a bleed caps the score at 40). The report adds an estimate of how many patients like this walk independently at three months.
- **Intro and tutorial:** the stroke room chart offers **How a thrombectomy works (1 min)**, an animated intro in six scenes (`js/stroke-intro.js`, played by the same player as the heart intro): a clot blocking a brain artery, time is brain, the route from the leg to the head, dye showing the blockage, the stent retriever step by step, and your job. New players get **Start the stroke tutorial**, which plays the intro first and then one guided patient (a left M1 clot on a simple arch) with a coach card that moves on when each step is done: X-ray on, into the left neck artery, up the neck, film it, find the clot, go deeper, through the clot, open the stent, grip then pull, check and finish. The tutorial's pass always succeeds. Skip either at any time; replay them from the chart.
- **Progression:** stroke cases count towards the streak, the skill grade, coffee tokens and badges (Clot buster, First-pass effect, Time is brain), and the casebook has a stroke chapter (bovine arch, type III arch, basilar occlusion) with an ink film of your first such patient.

**Rare patients and the casebook** (`js/casebook.js`, **Casebook** on the main menu). About one patient in thirteen is rare, decided by the case code so everyone with the code meets the same patient: an **anomalous right coronary** that starts high and to the front (turn further clockwise, come up higher), a **left-dominant heart** (the circumflex supplies the underside), **corkscrew arteries**, a **left main narrowing**, a **long narrowing** that only the 30 mm stent covers, and **kidneys on the edge** (a 30 mL dye limit on every difficulty, even Easy and Story). Rare patients are marked in case select and in the case header. Treating one adds its casebook page: what it is, why it is tricky, a tip, and an angiogram of your first such patient drawn by the game's renderer, with the date, the patient code, how often you have treated it and your best score. The casebook also ticks off the eleven presentations (stable angina variants, NSTEMIs and STEMIs by territory). Two badges go with it: Curiosity (your first rare patient) and The full casebook (all six).

**Sound** (`js/sound.js`). All synthesised with the Web Audio API, no sound files: a heart-monitor beep on every beat and a monitor alarm when the blood pressure collapses; a pedal click and a low hum while the X-ray is on, a brighter whir while recording; a hiss while injecting dye; a click when the catheter engages an artery and a snap on a whip; the inflator ticking up as the pressure rises, a whoosh as the balloon comes down, a ding when the wire crosses and a chime when a stent is in; a two-tone warning with every warning message; a chime for medals, achievements and weekly bests; and a very quiet tick on buttons. **⚙ Settings** in the header has sound on/off, the volume, the monitor beep and the button ticks. Settings are kept in this browser. Browsers only allow sound after the first click or key press.

**Weekly challenge** (`js/weekly.js`). One patient a week, Monday to Sunday, the same for everyone and always on Medium, with a twist that rotates from week to week:
- **Dye shortage:** half the usual contrast budget.
- **No shortcuts:** no view presets and no 3D heart; set the angles yourself.
- **Stiff catheter:** Hard catheter handling (grip, wind-up, whip, tight engagement windows) on a Medium patient.
- **Double trouble:** a patient with two badly narrowed arteries.
- **Low dose:** full radiation marks only up to half the usual dose.
- **Heart attack in progress:** a STEMI with the door-to-balloon clock running.

It appears as the **This week** folder in case select and as a link on the main menu. The chart shows the twist, the patient, your best this week with its medal, your top tries, the days left and your past weeks. The first completed try each week pays 15 tokens. The report shows the score, which try it was, where it ranks among your tries this week, and your best. Three badges go with it: Challenge accepted, Weekly regular (four different weeks) and Challenge champion (gold on a weekly challenge).

**Achievements, streak and skill grade** (`js/achievements.js`, **Achievements** on the main menu).
- **32 badges**, checked whenever a case is completed, each paying coffee tokens once: first case, first stent, clean sweep, every narrowing graded right, scores of 80 and 95, 60+ on Hard, saving dye, under 2 minutes of X-ray, no whip and no moving blind on Medium or Hard, using the pressure wire, leaving a narrowing alone after FFR, managing every complication in a case, managing all four kinds of complication, door-to-balloon under 90 and under 60 minutes, gold on today's case, 60+ on all four difficulties, 3-, 7- and 30-day streaks, 10 and 50 cases, and reaching grade A.
- **Streak:** consecutive days on which you completed at least one case (finished to the report; the tutorial does not count). It counts once a day, resets after a missed day, and keeps your best. It never affects the grade. The daily case card shows the same streak.
- **Skill grade:** the average over every completed case of the score multiplied by its difficulty (Story ×0.55, Easy ×0.75, Medium ×1, Hard ×1.2, capped at 100). Grades: E Observer, D Trainee (30+), C Competent (45+), B Skilled (58+), A Expert (70+), S Master (82+), S+ Legend (92+). Provisional until three cases. The screen shows the grade, the rating and raw average, the streak and best, cases, average and best per difficulty, and every badge (earned with its date, or locked with its reward). The report shows new badges, the streak and the grade after each case.

**For players outside medicine.**
- **How it works (1 min):** an animated explainer in six 10-second scenes (the heart's own arteries, plaque narrowing one, the catheter from the leg, dye and X-ray, balloon and stent, then your job in the game). It plays once for anyone who answers *new to angiography* or *some experience*, and any time from **How it works** on the main menu. Back, Pause, Next and Skip; arrow keys and Esc work too (`js/intro.js`).
- **Plain words** (switched in **⚙ Settings**): everyday language with the medical term in brackets, for example "middle of the front artery (LAD)", "Severe (70–89%)", "Dye used", "Radiation", "X-ray camera angle". Radiation and dye also show a low / medium / high bar, and the report opens with a plain summary ("You opened the badly narrowed artery. Blood flow in the front artery (LAD) went from about 35% to 100% of normal."). It covers every message too: the catheter status line, the pop-up messages during the case (whip, moving without X-ray, injections, devices, drugs, complications, tamponade, the door-to-balloon clock), the complication alerts, and every stage of the grading and treatment pop-ups including the sizing advice and drug descriptions. On by default for new and some-experience players; it can be switched at any time, even mid-case.
- **Story difficulty** (below Easy): one narrowing, very wide engagement windows so the catheter slides in almost by itself, no contrast limit, no complications, half tokens. New players start here.
- **Steering guide** (Story and Easy): a line under the X-ray says what to do next with your own keys (push up to the heart, turn clockwise or anticlockwise towards the artery, push in a little, pull back if too deep, then record and inject) and a warmer/colder bar fills as the tip nears the opening.

**Grading and treatment pop-ups.** Click a narrowing on a cine run and a grading pop-up opens on the X-ray, well clear of the lesion (which is ringed): towards the image edge across from it and shifted up or down away from it. Pick a grade (<50%, 50–69%, 70–89%, ≥90%) or discard the mark. A grade is final: the grading pop-up closes, and the same spot can't be marked or graded again. If the mark is on a real lesion, a second pop-up with the treatment options opens a moment later: FFR, Wire it, the device choice and sizing, Inflate, Remove wire, drugs and complication alerts, so the whole treatment is done from it. A wrong mark opens nothing. Drag either pop-up by its header up to 150 px for a better view (double-click the header to put it back). Close the treatment pop-up with ✕ and reopen it from **Treatment** in the side panel; it reopens by itself if a complication starts or you identify another lesion. When the lesion is treated (stented, or shown by FFR not to need it) and the wire is out, the pop-up goes away and the side panel keeps a log of the balloons and stents.

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
| `js/glossary.js` | The glossary (about 57 terms) and the links from the tutorial coach. |
| `js/career.js` | Career mode: the ranks, their goals and promotions. |
| `js/tutorial.js` | The play-through tutorial: experience levels, the tutorial patient and the coach's steps. |
| `js/heart3d.js` | The 3D heart view (three.js r128 from a CDN, loaded the first time you open it). |
| `js/controls.js` | Key and mouse bindings, the mouse input over the X-ray (buttons, wheel, drag to turn) and the Settings dialog (plain words, sound and controls). |
| `js/game.js` | Menu, operator profile and coffee tokens, game state, controls, cine runs and review, the PCI tools, the three-lead ECG and pressure strip, the main loop and scoring. |
| `css/style.css` | Layout and look. |
| `tools/render_cardiologists.py` | Blender script that renders the menu picture `assets/cardiologists.png`. |
| `tools/skull-model.js`, `tools/render_skull.html`, `tools/serve.py` | The stroke room's 3D skull and spine model, the page that X-rays it into `assets/skull-xray.png`, and a local server that serves the repo and saves the result. |
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
| Catheter feel | The arrow keys turn the hub; the tip follows through a springy shaft that drags on the aortic wall (most round the arch, more on harder difficulties). Small turns wind the shaft up without moving the tip, and the status line tells you how much twist is stored. On Hard the wall grips hard and lets go suddenly, so a stored twist whips the tip 20–25° past where you meant (the game shouts "Whip!"); on Medium it overshoots a little; on Easy the tip follows the hub exactly. Advancing or withdrawing a little frees it so the torque goes through. Round the arch the catheter rides the outer wall. Pushing on in the root without engaging folds the tip onto the aortic valve (prolapse): pull back and torque towards the ostium. |
| Engage | Torque the tip into the ostium: JL4 for the left main, JR4 (a clockwise turn) for the RCA. Near an ostium the tip drops in on its own. Switch between JL4 and JR4 with the catheter toggle (or X) from anywhere outside an ostium; it backs out of an engaged ostium first. |
| Watch the pressure | Advance too far and the aortic trace damps. Injecting through a damped catheter causes an ostial dissection and ends the case. |
| X-ray image | Drawn at 1024 px for sharp screens. Each vessel is its own attenuation layer, multiplied in as X-rays add up, so a vessel crossing another (or the spine, or the catheter) looks darker; each vessel is darker down its middle than at its walls, as a round contrast-filled tube is; and the bolus front blurs as it travels down the tree. |
| Record | Start a cine run, then inject. Contrast flows down the tree and washes out; flow beyond a severe stenosis is slow. RCA injections can cause brief bradycardia. |
| Choose views | The C-arm rotates in 3D (LAO/RAO, cranial/caudal). Some lesions are eccentric, so they look tight in one projection and mild in another. |
| Report | Replay a run, click the narrowing and grade it (<50%, 50–69%, 70–89%, ≥90%). |
| Wire | With the guide engaged, press Wire it next to a marked lesion and hold fluoro while a 0.014" wire crosses. |
| Balloon | Plain balloon angioplasty: 8–12 atm. Alone it recoils to about 30–45%. Use it to predilate a subtotal (≥90%) lesion before stenting, or to post-dilate a stent. Oversizing by more than 0.5 mm causes a dissection. |
| Pressure wire (FFR) | For an intermediate (50–69%) narrowing, press **FFR** next to its mark instead of Wire it. The pressure wire crosses, then **Give IV adenosine**: the blue distal pressure falls against the red aortic pressure and the FFR (their ratio at maximal flow) is read. 0.80 or less limits flow: treat it (the pressure wire doubles as your working wire). Above 0.80: leave it. Scoring follows this: an intermediate narrowing needs treating only if its FFR is 0.80 or less, a stent in one above 0.80 is unnecessary, and a lesion you measured is judged on your reading. |
| Stent | Pick a diameter and length. Sizing help: on Easy the panel shows the vessel's size and the narrowing's length and stars the best-fitting device; on Medium a size range (compared with the 2 mm guide) and a rough length; on Hard the rules only (stent 1:1 with the vessel and 2–3 mm longer than the narrowing each side; predilating balloon 0.5 mm smaller; post-dilating balloon the stent's size or up to 0.5 mm bigger). For scale, the 6F guide is 2 mm wide. nudge the markers around the narrowing, then hold Inflate to deploy at 12–14 atm (pressure rises about 2.8 atm a second, so 12 atm takes about 4 s). Take a final shot, remove the wire, finish. |
| Complications | **Dissection**: an oversized balloon or stent, inflating above 16 atm, or (occasionally) balloon angioplasty of a hard lesion or a stent edge can tear the vessel wall. It shows as a flap, a second channel of contrast beside the lumen and staining that lingers after the injection. Left alone it narrows and then closes the vessel (Easy 80 s, Medium 55 s, Hard 35 s): cover it with a stent (**Aim devices here**, or **Wire it** again if the wire is out). **No-reflow**: after a stent, more often in an NSTEMI, a subtotal lesion or a long stent, the stent stays open but contrast crawls beyond it. Give intracoronary **verapamil** or **adenosine** through the engaged guide until flow is brisk; GTN does little. Both start with chest pain, ST elevation in the territory lead and falling blood pressure, and are only named once you inject and see them. |
| Perforation and tamponade | **Perforation**: a balloon or stent more than 1 mm too big, or inflated above 16 atm, can tear right through the vessel: a jet of contrast squirts out and pools beside the heart. A wire can also exit the tip of a small distal vessel (hydrophilic wires do this more often). Blood fills the pericardium: an untreated big hole tamponades in about 36 s (BP collapses with a narrow pulse pressure, HR races) and a cardiac arrest ends the case. Seal a big hole with a **covered stent**; a distal wire exit with a **coil** or a 15 s low-pressure balloon inflation (**Aim devices here** caps the balloon at 6 atm and stops the leak while held). **IV protamine** slows the leak; **Pericardiocentesis** drains the effusion and restores BP, but it reaccumulates until the hole is sealed. |
| Spasm | Engaging an ostium (the RCA more than the left), deep-seating the catheter, or passing the wire can cause **spasm**: a smooth, concentric narrowing that looks the same in every view. Tight spasm causes chest pain and ST elevation. **Intracoronary GTN** relieves it (verapamil partly, adenosine not); it also settles by itself once the catheter or wire is gone. Don't grade or stent it: a mark or stent on spasm is penalised. On Easy the panel names it once imaged; on Medium and Hard only tight, symptomatic spasm gets an alert. |
| ECG | Three leads follow the coronary territories: V3 anterior (LAD), V5 lateral (circumflex), II inferior (RCA). An inflated balloon raises ST in that territory's lead with reciprocal depression elsewhere. Patients with an NSTEMI start with T-wave inversion in the lead facing the culprit vessel. |

## Tutorial

Before your first case the game asks how much angiography you have done: **new to angiography**, **some experience** or **experienced**. Then it offers a short play-through on one complication-free patient (a proximal LAD stenosis, on Easy). A coach card under the monitor gives one step at a time, highlights the control you need, and moves on when you have actually done it: switch on fluoro, advance, engage the left main, record a cine run, take a second view, mark and grade the narrowing, wire it, stent it, check the result, finish. New players get every step with the anatomy explained; some experience gets shorter notes; experienced players get a seven-step run through this game's controls only. Afterwards the difficulty is set to suit (Easy, Easy, Medium). Replay it any time from **Tutorial** on the main menu. Returning players (anyone who has played a case, finished or skipped the tutorial) go straight to the cases, and both tutorial screens have a skip button.

## Career

**Career** on the main menu is a ladder of ranks: Medical student → Junior fellow → Fellow → Senior fellow → Interventional fellow → Consultant cardiologist → Interventional consultant → Head of the cath lab. Each rank has one goal (for example two Easy cases scoring 60+, a STEMI opened within 90 minutes on Medium, a complication managed on Medium or Hard, two Hard cases scoring 60+). Every finished case counts; **Next career case** picks a patient that fits the goal (a STEMI, or one with a complication waiting). Promotions pay coffee tokens, and your rank shows on your operator card and in the report.

## STEMI and the door-to-balloon clock

About one random patient in six arrives with a STEMI: the culprit artery is completely blocked (no contrast gets past it, TIMI 0) and the ECG shows ST elevation in its territory with reciprocal depression. On **Medium and Hard** a door-to-balloon clock runs (top right, D2B): it starts with the 35–50 minutes already spent getting the patient to the lab and runs at a minute every 4 seconds (3 on Hard). The clock stops at the first balloon or stent that opens the culprit; within 90 minutes scores in full, every 4 minutes over costs a point (up to 6), and never opening it costs 6. On Easy there is no clock.

## Teaching mode (Easy)

Reviewing a cine run on Easy adds frame-by-frame buttons (◀ ▶), names on each vessel holding contrast (switch them with **Labels on/off**), and a note on what that projection shows best (for example, the "spider" view for the left main splitting into the LAD and circumflex).

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

## 3D heart view

**3D heart** (in the C-arm panel, Easy and Medium) opens an orbitable 3D model of this patient's heart: the four chambers, the aorta with its arch branches, the pulmonary artery, the cavae, and the patient's own coronary tree, drawn in the same ink style (parchment chambers, coronaries in oxblood ink). During a case it shows anatomy only and starts from your current C-arm angle, so you can see what the projection is looking at; buttons jump to AP, LAO 45 and RAO 30. **View in 3D** in the report adds every lesion (a ring coloured by what is left, labelled before → after), your stents and any complications. Drag to turn, scroll or pinch to zoom. The viewer needs an internet connection the first time (it loads three.js).

## Glossary, save and resume

**? Glossary** in the header (and on the menu) explains about 57 terms, from ostium and LAO to FFR, TIMI flow and tamponade, with a search box. In the tutorial, terms are underlined: tap one to read it.

An unfinished case saves itself every couple of seconds and when you leave the page. The main menu then shows **Unfinished case** with **Resume** (the same patient, picking up where you were, with your runs, marks, devices and complications) or **Discard**. A cine run being recorded at that moment is not kept.

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

Defaults: Space (or F) hold fluoro · X switch catheter · C start/stop cine · J hold to inject · ↑/↓ (or W/S) advance/withdraw · ←/→ (or A/D) torque counter-clockwise/clockwise · B hold to inflate a balloon or stent · 1–7 C-arm presets. Touch devices use the on-screen buttons.

**Choose your own.** **⚙ Settings** in the header (or **Settings** on the main menu) holds plain words, sound and the controls, and lets you bind every action to two inputs: any key, a mouse button or the scroll wheel. Click a box, then press the key, click the mouse button or scroll; Backspace clears a box and Esc cancels. An input already in use moves to the new action. The **Mouse + keyboard** layout sets left click for fluoro, right click to inject, the wheel to advance and withdraw and middle click to record, and turns on **drag to turn**: hold the left button on the X-ray and drag sideways to torque the catheter. Mouse buttons and the wheel act only over the live X-ray image (not on buttons, pop-ups or menus, and not while reviewing a run, when a click marks a lesion). Bindings are saved in this browser (`js/controls.js`).

Teaching game with simplified anatomy and physics. Not a clinical training device.
