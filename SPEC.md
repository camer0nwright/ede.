# ede. — Spec

Version 4. The AI plan-engine system prompt lives in [prompts/plan-engine.md](prompts/plan-engine.md). Write the name as "ede." (lowercase, with the full stop) in the UI; plain sentences can just say "ede".

## One-line pitch
ede. is an AI coach that builds and adapts weekly plans for people who lift and run, so the two support each other instead of clashing.

ede. combines the guided, goal-based running plan of a running coach app with the fast set-by-set logging of a lifting tracker, in one plan that manages both.

## Target user
Recreational hybrid athletes training 4-6 days a week, combining running and lifting, with a goal (race, strength target or general fitness) and a busy life.

## Core problem
Hybrid training creates interference: heavy leg days hurt run quality, long runs hurt lifting, and recovery gets squeezed. Most people follow two separate plans that don't talk to each other.

## Session types
Run, strength (lifting) and rest only. No swimming or cross-training.

## Core loop
1. Onboarding: goal, target date (optional), experience level (beginner, intermediate or advanced), current weekly training, equipment, injury history, strength volume setting, and the weekly availability grid (below) — plus race distance (5K, 10K, half marathon, marathon or ultra), and for ultras the distance, elevation gain and terrain; and units (kg or lb, km or miles)
2. AI plan generation: the AI generates each week's sessions in a structured format (type, duration, intensity, step-by-step details), using the plan-engine prompt; it fills in the sessions that the plan outline (see Plan outline and session variety) has already chosen for that week
3. Plan checker: the app validates the AI's output against fixed rules and asks the AI to regenerate if a rule is broken
4. Session check-in: completed or skipped, effort (1-10), notes, plus logging (see Logging)
5. Skip workout: the user picks a reason (injury, illness, holiday, work/life, fatigue, other) and the AI recalculates the plan around it
7. Coach chat: the user can ask the AI coach questions at any time (see AI coach chat)
6. Weekly summary: what was done, what changed and why, what's next

## Weekly availability grid
- Monday to Sunday, each day set to Rest or an available time (e.g. 30, 45, 60, 90, 120+ minutes), so users can have longer sessions at weekends
- A "double day" toggle per day, allowing two sessions (one run, one lift), each with its own time length
- Summary showing training days, double days and full rest days (double days exist to create more full rest days)
- For ultra plans, longer options are offered (3h, 4h, 5h, 6h+) so long runs and back-to-back long runs can be planned
- The plan-engine prompt instead describes one time per day, with both sessions on a double day fitting within it combined. See Decisions (v4), item 1.

## Strength volume setting
Chosen in onboarding, changeable later in the profile. ede. pre-selects Low for hybrid athletes and explains why in one line ("keeps your legs fresh for running").

| Option | Exercises per session | Working sets per exercise | Effort | Session length |
|---|---|---|---|---|
| Low (recommended for hybrid) | 3-5 | 2 | RPE 8.5-9.5 | 30-45 min |
| Moderate | 4-6 | 3 | RPE 8-9 | 45-60 min |
| Higher | 5-7 | 3-4 | RPE 7.5-9 | 60-75 min |

- Warm-up sets are listed separately and are not counted as working sets.
- True failure only on machine, cable or isolation exercises. Never on heavy barbell squats, deadlifts or similar lifts.
- Push harder toward Low when: 4+ runs a week, a race within about 8-10 weeks, or the user is a beginner.
- If someone picks Higher while running a lot, show a gentle "this may affect your running recovery" note rather than blocking them.
- Beginners: lower RPE for the first weeks and machines/dumbbells first (see prompts/plan-engine.md). This overrides the intensity ranges above.
- Philosophy behind the default: low volume, high intensity (2 hard working sets per exercise) works best for hybrid athletes.

## Coaching rules
- Most running is easy: about 80% easy, 20% moderate to hard.
- A hard run day can be followed by a hard gym day and vice versa. Two hard runs, or two strength sessions, are not placed on consecutive days.
  - Changed (decision 14): strength sessions may be on consecutive days. Only two hard runs on consecutive days are ruled out. A hard lift is fine the day after a hard run as long as it is not legs.
- After a hard or long run, prefer upper body the next day. Lower-body lifting the day after a hard or long run is a fallback, at no more than RPE 8.
- No heavy lower-body lifting the day before, or the same day as, a hard or long run (extends the existing "day before a key run" rule).
- On a double day with a hard or long run, the run comes first and the lift at least 6 hours later, noted in the day's notes.
- The 10% weekly progression limit applies to RUN minutes only, not total minutes.
- Starting load: if last week's run minutes are under 60 or missing, ignore the 10% rule and start at 40-60 run minutes (beginners, run/walk) or 60-90 (others), split across 2-3 sessions.
- Recovery phase: reduce total volume by about 30-40% and keep intensity easy to moderate.
- Taper: if the target date is within 2 weeks, cut volume and keep a little intensity.
- Beginners: all running easy with run/walk intervals; strength at RPE 6-7 on machines and simple movements for the first 4 weeks, RPE 7.5-8.5 from week 5, and 8.5-9.5 only after 8+ weeks of consistent training. Prefer machines and dumbbells over heavy barbell lifts for the first 8 weeks.

## Plan outline and session variety
Sessions change and rotate week to week, in the style of a structured running-coach app, and are suited to what the user chose in onboarding.
- **Whole plan up front.** Right after onboarding, code (not the AI) builds a plan outline for the whole plan: up to the target date, or rolling 8-week blocks that repeat when there is no race. For each week it sets the phase, target run minutes, and which session type and level goes in each role. The user can see the whole plan, week by week.
- **Weekly roles.** Each week has roles such as easy runs, one or two quality sessions, a long run and strength sessions. The number of each depends on availability, goal and experience.
- **Session library (in code).** Each session type has progression levels: intervals (several levels), tempo/threshold, hills, fartlek, progression runs, strides, long run variations (all easy, fast finish, race-pace section), run/walk steps for beginners, and for ultras the session types in Ultra training.
- **Rotation and progression.** Quality sessions rotate (for example intervals, then tempo, then hills or fartlek), and a session type comes back at the same or a higher level. The same main hard session type is not used two weeks in a row. The checker enforces this as: a week's set of quality session types is never the same as the week before, and a type never comes back at a lower level outside recovery and taper weeks (decision 18).
- **The AI fills in each week when it is due.** It turns the outline's session types into full sessions, fits them to that week's availability, and adapts to check-ins and skipped sessions.
- **Suited to onboarding choices:**
  - Goal and race distance: 5K/10K lean to intervals; half marathon/marathon lean to tempo and longer long runs; ultras follow Ultra training; strength goals get fewer quality runs and more lifting; general fitness gets fartleks and mixed sessions.
  - Experience: beginners stay all easy; their variety comes from progressing run/walk ratios (for example 1:1, then 3:1, then 5:1).
  - Availability: the number of run days sets how many quality sessions fit; the day with the most time gets the long run.
  - Strength volume and equipment shape the gym sessions. Main lifts stay the same through a block (so logged weights can progress); accessory exercises rotate week to week.
  - Injury overrides everything else.
  - Recent 5K time gives pace targets (v2).

## Ultra training
For races longer than a marathon. The user enters the distance (for example 50K, 50 miles, 100K, 100 miles or a custom distance), and optionally elevation gain and terrain (road, trail or mountain). The plan is built around that distance. Based on coaching practice (most guidance comes from coaches and published plans rather than controlled studies):
- **Mostly easy.** Ultra plans aim for about 90% easy running; the 80% minimum still applies. Hard work comes in small doses: strides, short hill repeats, moderate "aerobic power" runs below threshold, and occasional fast-finish long runs, which are the hardest sessions.
- **Time on feet, not distance.** Long runs and weekly volume are planned in time.
- **Back-to-back long runs** (for example Saturday then Sunday) build time on feet on tired legs with less injury risk than one very long run. Introduce them gradually, about every 4-5 weeks, with the biggest blocks roughly 8, 5 and 3 weeks out.
- **Peak long run** (guide, adjusted for experience and terrain): 50K about 3.5-4 hours; 50 miles about 4-5 hours; 100K about 5-7 hours; 100 miles about 6-8 hours, or a big back-to-back weekend.
- **Terrain-specific.** For trail or mountain races with significant elevation gain, long runs include hills and power hiking, plus hill-specific sessions.
- **Race rehearsal.** Long runs practise fuelling, kit and walking breaks (in the session notes).
- **Plan length** (guide): 50K 12-16 weeks from a marathon-level base; 100K 16-20 weeks from a 50K base; 100 miles 20-30 weeks with ultra experience. If the target date gives less time, ede. builds what fits and shows a gentle note.
- **Taper:** 2 weeks for 50K-100K; 3 weeks for 100 miles.
- **Readiness note:** beginners or people without a recent marathon-level base who choose an ultra see a gentle note suggesting a longer build, rather than being blocked.
- **Strength** stays at Low volume by default to protect running recovery.

## Gym sessions and logging
Planned gym sessions work like the running plan (each session laid out in advance with exercises, sets, reps and target effort), with fast set-by-set logging in the style of a gym-tracker app.
- **Start a planned session** and its exercises load with the planned sets: warm-up sets marked separately, working sets with target reps and RPE, and the weight and reps from last time pre-filled next to each set.
- **Log each set** as weight, reps and RPE, and tick it done. Add or remove sets, swap an exercise for an alternative that suits the user's equipment, add an exercise, and write notes per exercise or per workout.
- **Set types:** warm-up, working, drop set and failure (failure only where failure_allowed).
- **Rest timer** starts automatically when a set is ticked, with a default per exercise (for example about 2-3 minutes for big compound lifts, 60-90 seconds for isolation work). It can be changed or turned off.
- **Finish screen:** duration, sets done, total volume, and what beat last time.
- **Progression:** next session's targets come from code using double progression: when every working set hits the top of the rep range at or under the target RPE, the weight goes up by the smallest step; otherwise reps go up. The AI can hold progression back for fatigue, injury or a recovery week, and explains changes in the weekly summary.
- **A workout in progress is saved as it goes,** so closing the page does not lose logged sets.
- **Units:** kg or lb, with sensible weight steps (for example 2.5 kg / 5 lb on barbells).
- Later: supersets, warm-up set calculator, plate calculator (v2); personal records and charts (v3, as in Logging).

## How plans are made and adapted
- **Plan outline (code):** the plan's shape: phases, recovery weeks, taper, weekly run minutes, and which session types and levels rotate in. Built after onboarding, and rebuilt from where the user actually is after big changes (injury, missed weeks, a new race date).
- **Weekly plan (AI):** each week's actual sessions (days, steps, exercises, notes), fitted to that week, written when the week is due.
- **Plan checker (code):** validates every AI-written or AI-changed week against the fixed rules, and asks the AI to fix anything broken.
- **Adapting (AI, kept in check by code):** changes after skips, illness, injury, holidays and check-ins, always passing the checker.

## AI coach chat
A "Coach" screen where users can ask the AI anything about their training.
- **Context:** the user's goal, race date, plan outline and weeks, recent check-ins, logged lifts and runs, and injuries, so answers are about their own training.
- **Suggests changes, never makes them silently:** the coach proposes a change (for example moving a long run), the user confirms with a tap, and the change goes through the plan checker like any other.
- **Safety:** the same rules as the rest of ede.: words like chest pain or dizziness trigger cautious advice and a suggestion to see a doctor; the "not medical advice" notice applies.
- **Server-side only:** all AI calls run on the server; API keys never reach the browser.
- **Cost control:** a sensible daily message limit per user.
- **Chat history** is saved per user.
- v1: questions with full context, plus suggested changes the user confirms. Later: a short message after each workout (as in Logging v2).

## Session data model
A day holds one or two sessions. Each session has: type (run or strength), duration, intensity, planned vs actual, effort rating, and optional structured steps (warm-up, intervals, cool-down for runs; exercises, sets and reps for strength).

The plan engine's output also gives each session a key-session flag and a body focus (upper, lower, full, or none for runs); each strength exercise has warm-up sets, working sets, reps, target RPE and failure_allowed; each day has notes; and the week has a phase, run minutes, strength minutes and a coach note. The exact output format is in prompts/plan-engine.md.

## Plan checker rules (enforced by the app, not the AI)
- Gradual weekly load progression, with a recovery week every 3-4 weeks
- Weekly run minutes within about 10% above last week's run minutes (strength minutes don't count), with the starting-load exception above
- At least 80% of weekly running time is easy (counted from the planned minutes of runs marked easy)
  - Changed (decision 17): counted step by step: time at RPE 4 or less is easy, including warm-ups, cool-downs and the easy part of a fast-finish long run
- No heavy leg session the day before a key run
- No heavy lower-body session the day before, or the same day as, a hard or long run
- No hard run followed by a hard run, and no strength session followed by a strength session, on consecutive days
  - Changed (decision 14): only hard runs on consecutive days are ruled out; strength sessions may be on consecutive days
- At least one full rest day per week
- Sessions fit within the time set for that day
- Double days are a run plus a lift only, never two hard sessions back to back, and no heavy legs on a double day that includes a key run
- Working sets per exercise must match the strength volume setting
- Most exercises in each strength session are hard for the strength volume setting (decision 15)
- No heavy lower-body sessions on consecutive days (decision 16)
- failure_allowed only on machine, cable or isolation exercises
- Injury severity rules (see prompts/plan-engine.md): pain 0-3 reduces runs, 4-6 means no running, 7+ means no running and no lower-body lifting. While an injury is active, run minutes don't go above last week's.
- Taper logic if a target date is set
- Cap on how much the plan can change in a single recalculation
- The checker re-validates every hard rule in prompts/plan-engine.md on the returned JSON and asks for a regeneration if one is broken, rather than trusting the model.

## Skip workout behaviour
- Illness/injury: conservative return with a gradual ramp, no cramming missed sessions
- Injury: ask for body area and pain level; if severe or persistent, advise seeing a physio or doctor
- Holiday: ease back in on return
- Life/work: usually carry on without making up missed sessions
- Check-in notes are scanned for words like pain, dizzy or chest, which trigger cautious advice
- A short "not medical advice" notice appears in onboarding and the footer
- The skip-workout recalculation prompt is separate and still to be written (prompts/skip-workout.md).

## Injury input
Used in onboarding and skip workout. Capture: area, pain level (0-10), and when it hurts (running, walking, resting, lifting only). Free-text notes are still scanned for words like pain, dizzy or chest.

## Logging
- v1: strength sets logged as weight and reps per working set, with last session's numbers pre-filled and a rest timer; the AI adjusts next session's targets (progressive overload). Runs logged manually (distance, time, effort).
- v1 detail for gym logging is in Gym sessions and logging; next session's targets come from code-based double progression, which the AI can hold back.
- v2: Strava import, pace targets (needs a recent 5K time from onboarding), AI feedback after each workout, Garmin push once the Training API is approved.
- v3: progress charts, personal records, history.
- Skip: social feed, community, in-app GPS tracking, exercise videos.

## Data to add
Stack-agnostic; implement in the existing Prisma schema.
- Profile: strength_volume (low, moderate, high), experience_level (beginner, intermediate, advanced), recent_5k_minutes (optional), injury area / pain level / pain_when; race_distance (5K, 10K, half, marathon, ultra), ultra_distance_km, elevation_gain_m and terrain (road, trail, mountain) for ultras; units (kg/lb, km/miles)
- Exercise library: name, muscle group, equipment, is_lower_body, failure_allowed, default rest seconds, weight step, alternatives, is_main_lift
- Set logs: session, exercise, set number, is_warmup, planned reps and RPE, actual weight, reps and RPE; set type (warm-up, working, drop, failure); completed time
- Run logs: session, distance_km, duration_seconds, avg_heart_rate (optional), notes
- Weekly record: run_minutes and strength_minutes, so next week's plan can use last week's run minutes; phase (base, build, peak, taper or recovery)
- Plan outline: per week, phase, target run minutes, and each role's session type and level
- Workout in progress: the live gym session's logged sets, saved as they are entered

## Garmin (stretch goal)
v1 shows each run clearly in the app with step details. Apply for Garmin's Training API early; add "send to watch" once approved.

## Out of scope for v1
Strava/Garmin data sync, nutrition tracking, payments, social features, a native mobile app, exercise video library

## Success criteria
5 real users complete 2 weeks of check-ins, and at least 3 say the plan adjustments felt sensible.

## Decisions (v4)
Places where the v4 additions or the plan-engine prompt disagreed with the earlier spec, or left something undefined, and what was decided.
1. **Double-day time.** Keep a separate time for each session on a double day (as in the availability grid). The plan-engine prompt, which describes one combined time per day, will be updated to receive both times.
2. **Recovery week size.** A recovery week cuts volume by at least 30% (at most 70% of the last build week), matching the prompt's 30-40%.
3. **Long run.** The week's longest run, if it is 60 minutes or more. For back-to-back long runs, a 60+ minute run on the day before or after it is also a long run.
4. **Heavy lower-body.** A strength session with a lower body focus, or a full-body session with a lower-body exercise at RPE 8 or above. Until the exercise library exists, every exercise in a full-body session is treated as possibly lower-body.
5. **Key run.** "Key run" now means a hard or long run. The output's is_key_session is kept as the AI's own marker.
6. **Progression measure.** Only run minutes have a progression limit. Strength minutes have no separate limit in v1.
7. **Whole plan up front.** Code builds a plan outline for the whole plan right after onboarding; the AI fills in each week's details when it is due.
8. **Race distances.** 5K, 10K, half marathon, marathon and ultra (with a distance entered).
9. **No race date.** Rolling 8-week blocks that repeat, each with a recovery week.
10. **Strength variety.** Main lifts stay the same within a block; accessory exercises rotate.
11. **Ultra intensity.** Aim for about 90% easy running in ultra plans; the checker's 80% minimum still applies to all plans.
12. **Gym progression.** Code-based double progression sets next session's targets; the AI can hold it back and explains why.
13. **Taper loads.** Race week at most 60% and the week before at most 80% of the last full week; 100-mile ultras add a third taper week at most 90%.
14. **Consecutive days.** Strength sessions may be on consecutive days, as some plans need it. Two hard runs on consecutive days are still ruled out. A hard lift is fine the day after a hard run as long as it is not legs (lower body the day after a hard or long run stays at RPE 8 or less). Most lifting sessions should be hard. The plan-engine prompt's rule 7 is updated to match in step 5.
15. **Most lifts are hard.** In each strength session, most exercises (more than half) are at or above the strength volume setting's lowest RPE (Low 8.5, Moderate 8, Higher 7.5). Not applied to beginners, recovery or taper weeks, or lower-body work capped the day after a hard or long run. The plan outline plans strength sessions as hard by default.
16. **No consecutive leg days.** Heavy lower-body sessions are not placed on consecutive days.
17. **Easy running is counted by step.** For the 80% rule, time at RPE 4 or less counts as easy, even inside an interval or fast-finish session. Runs without steps count by their intensity.
18. **Variety rule.** A week's set of quality session types must differ from the previous week's, and a session type never returns at a lower level except in recovery and taper weeks. The plan engine may echo each run's session_kind and level (optional fields) so the checker can see them.
19. **Plan outline scope.** The outline sets each week's phase, run minutes and sessions (kind, level, minutes, and strength focus and effort), fitted to the user's longest available days. The AI places sessions on specific days. Its numbers live in OUTLINE_CONFIG, and its tests check every plan against the plan checker's limits.
20. **AI coach chat in v1.** Users can ask the AI coach questions with full context of their training; the coach can suggest plan changes, which the user confirms and the plan checker validates.
21. **UI stack and look.** shadcn/ui (on Radix) with Vaul bottom sheets, Sonner notices and Lucide icons, all free and open source. Bold and sporty, dark first: near-black surfaces, an electric-lime accent, blue for runs, orange for lifts, and green/amber/red for easy/moderate/hard. Light and dark follow the phone's setting in CSS, with no theme script. Headings use a condensed display face (Barlow Condensed); "ede." is always lowercase.
22. **Race blocks.** Recovery weeks are planned backwards from the taper: blocks of 2-3 build weeks plus a recovery week, ending with the peak build weeks right before the taper, so no recovery week sits just before it.
23. **Data storage.** Injuries are their own table (active until resolved), so injury history is kept. A workout in progress is a session with status "in_progress", whose set logs are saved as they are entered. Weights are stored in kg and distances in km, shown in the athlete's units. Plan outlines are stored as JSON, one active per athlete. The exercise library lives in code (src/lib/exercise-library.ts) and the seed script copies it to the database.
24. **Exercise library and the checker.** failure_allowed is checked against the library: only machine, cable or isolation exercises, and exercises not in the library can't be taken to failure. Heavy barbell lifts stay at RPE 9 or less. The library also says which exercises are lower body (refining decision 4) and which body areas each one loads, for the injury rules.
25. **Onboarding.** Eight short screens: welcome, goal (race distance; for ultras distance, terrain and elevation; race date), experience and last week's running, lifting (Low pre-selected; a gentle note for Higher with a lot of running, or non-Low for beginners) and equipment, injury (area, pain 0-10, when it hurts, with cautious advice for warning words or strong pain), the availability grid (ultras get 3h-6h+ options), name and units, then a review. The server validates the answers again, saves the athlete and builds the plan outline. Plans start on the next Monday (today if it's Monday).
26. **No accounts yet.** Until sign-in exists, a cookie remembers which athlete is "you" on a device; without one the screens show the demo athlete. Sign-in is needed before the 5 real test users.
27. **Plan outline balance.** Quality sessions take the shortest day they fit on and never the week's longest remaining day; easy runs fill the shortest days first; at least 2 lifts a week are kept (dropping runs to 3 first); recovery and taper weeks keep a light 30-minute lift and trim running first. Reps sessions list their easy recoveries as separate steps, so they count as easy running. For ultras, only the top time option (6h+) is open-ended.
28. **Desired time and race date are required for races.** Desired time is entered as hours:minutes (minutes:seconds for 5K/10K), or "Just finish". Very ambitious times get a gentle note. Non-race goals keep an optional "anything specific".
29. **Chosen session counts.** Onboarding asks for runs (1-6) and gym sessions (1-5) a week in the plan; the plan gives exactly those every week, including recovery and taper weeks (lighter, not fewer). Starting-load weeks may have fewer runs, with a note. The week step checks the sessions fit (double days hold one run and one lift).
30. **Lifting recommendation.** Moderate is recommended and pre-selected, except Low for beginners, ultras and 5+ runs a week (this replaces "pre-selects Low").
31. **Week step.** Three quick questions (days, weekday time, weekend time) fill the week; any day is fine-tuned in a bottom sheet.
32. **No effort labels on lifts.** Easy/moderate/hard is shown for runs only; lifts show their focus, accessory set, and "Lighter week" or "Technique focus" when relevant.
33. **Code places sessions on days.** The week builder (src/lib/week-builder.ts) puts every run and lift on a day using the availability and the plan checker's rules, and the AI may adjust days later. Weeks too full to place safely are relaxed step by step (a quality run becomes easy, an easy run is shortened to share a double day). Every built week of every test plan passes the full plan checker.
34. **Gym sessions list real exercises.** The strength builder (src/lib/strength-builder.ts) picks exercises from the library by focus and strength volume, using only the athlete's equipment, avoiding injured areas, keeping beginners off barbells for 8 weeks and capping lower-body effort after a key run. Main lifts hold for a block; accessories alternate week to week. Each exercise shows warm-up and working sets, reps, target RPE and rest. ("Accessories A/B" is no longer shown.)
35. **Every session says why.** Each run kind and gym focus has a one-line purpose and a practical tip, shown in the week view and session sheet. The week view lists Monday to Sunday with rest days, an effort bar per run, and Skip / Mark done buttons (working once check-ins exist).
36. **Long runs and "just finish".** Long runs have ceilings by race distance, goal and experience (beginner / intermediate / advanced): 5K just finish 40/50/60, time goal 50/65/75; 10K 60/70/75 and 70/85/95; half 100/110/120 and 110/120/140; marathon about 3 hours (165-180); ultras as before. "Just finish" plans peak at 80% of the usual weekly running, have one gentle quality session a week (fartlek, progression, hills or tempo, never hard intervals or race-pace long runs) and walk breaks are fine. Easy runs stay at most 75% of the week's long run.
37. **Long runs grow from the longest recent run.** Onboarding asks for the longest run in the last month; the long run starts there and grows by at most 10 minutes per full week (recovery weeks 70% of the last full week's long run; taper 85/70/50%). A quality session is never longer than the long run.
38. **Starting load is judged on the last full week,** so a light recovery week doesn't restart a beginner's build (checker and outline).
39. **Order of work:** training logic and coaching first, then the You section (edit plan settings, injuries, units and account, progress summary), then sign-up with email and password. ede. is free while testing; pricing and a free trial are designed later.
40. **Paces and coaching.** Onboarding asks "What should we call you?" (required), the longest run in the last month, and an optional recent 5K time. With a 5K, run steps show pace guides (bands around 5K pace by effort) and ede. compares the desired time with Riegel's prediction from the 5K. Effort (RPE) stays the main target. The plan-engine prompt carries the same race-specific guidance (5K to ultra, just finish vs time goal). Just-finish 5K and 10K plans recommend 3 runs a week.
41. **Editing plan settings.** The You section edits one section at a time (Goal, Training, Lifting, Your week), using the setup screens prefilled. Saving rebuilds the plan from next Monday (or from the plan's own start if it hasn't begun): this week and earlier are saved exactly as they were, and the new outline carries on from the last full week's running, the long run, the session rotation and levels, and the recovery-week rhythm. Every built week across the seam passes the plan checker. Editing Training doesn't ask about last week's running again; the plan's own weeks are used instead.
42. **Coming back from an injury.** When an injury is marked better, the plan is rebuilt from next Monday with a gentle ramp: 80% of the pre-injury load if easy running continued, otherwise 70% after a week out, about 10% less for each extra week, never below 30% (the normal starting load then applies, and is always allowed). The first week back is easy running only, session levels start again from the bottom, and the recovery-week rhythm restarts. The weeks so far are saved as they were, injury changes included.
43. **Reporting an injury.** The You section reports, updates and marks injuries better, and keeps a history. The plan adapts from the day it's reported (earlier sessions stay), in code, by band: mild (pain 0-3) means easy, flat runs at no more than 80% of the last week before the injury (so running comes back after an update from moderate to mild); moderate (4-6, or pain when walking) pauses running; severe (7+, or pain at rest) pauses running and leg work, upper body only. Lifts always avoid the injured area, and leg work kept lighter after a run that's been removed goes back to normal. Each injured week's coach note explains the change and points to a physio (moderate) or doctor (severe). Today and Plan show a banner while an injury is active. The plan checker treats injured weeks as breaks in the build (no starting-load or recovery-rhythm demands while injured), and caps the first week back at 80% of the last week before the injury.
44. **Settings and account.** The You section changes your name and units (kg or lb, km or miles) straight away; units change how weights, distances and pace guides are shown, never the plan. "Delete my data" asks for confirmation, then permanently deletes the athlete and everything linked to them (plans, weeks, sessions, logs, injuries, coach messages) and returns the device to the demo.
45. **Accounts.** Email and password, built in (no third-party auth). Setup comes first; at the end the plan is kept for that device and the next screen creates the account ("Save your plan"), which claims the plan and signs in. Plans made before accounts existed are claimed the same way on the next visit. Passwords are hashed with scrypt and a random salt; a signed-in device holds a random token in an httpOnly cookie for 90 days and the database stores only its SHA-256 hash. Log-in gives the same message for a wrong email or password. Signed in, setting up a new plan replaces the account's plan. Log out returns the device to the demo. Password reset by email comes later (it needs an email service).
46. **Check-ins (part 1).** Every session can be marked done (time, effort 1-10, optional notes, and optional distance for runs, in the athlete's unit) on the day or after, or skipped with a reason (injury or pain, ill, holiday or travel, work or life, too tired, something else) at any time; both can be undone. A week is saved to the database the first time something in it is checked in, so it no longer changes. Lists show done (tick) and skipped (struck through, with the reason); the week strip's dots are solid once done and grey if skipped; Today lists earlier sessions this week still to check in; You shows sessions done so far. Notes are scanned for warning words (chest pain or dizziness: see a doctor; pain: report an injury), and skipping for injury points to reporting it. Rebuilding or replacing a plan keeps weeks that have check-ins. Gym set logging (part 2) and plan changes after skips (part 3) follow.
47. **Gym logging (part 2, step 1).** "Start workout" on a gym session (on the day or after) opens a full-screen workout: each planned exercise with its warm-up and working sets and targets (reps @ RPE), and last time's weight and reps per set (tap to copy). Weight boxes start empty the first time. Each set is logged as weight (the athlete's unit, stored in kg), reps and an optional RPE, and saved the moment it's ticked, so a closed page resumes where it was ("Resume workout"). Ticking starts a rest timer (the exercise's default; 60 s after warm-ups) with ±15 s and skip, and the phone buzzes at the end. Sets can be added, extra ones removed, and a set's type changed (warm-up, working, drop, failure where allowed). Finish asks for overall effort and notes, marks the session done with its real duration, and shows a summary: time, sets, weight lifted, what beat last time, every set. A workout can be discarded. "Mark done without logging" stays for quick check-ins and doesn't affect progression. Swapping and adding exercises, and automatic progression, are step 2.
48. **Moving sessions.** A session that isn't done, skipped or started can move to another day of its own week, from today to Sunday (including one missed earlier in the week). "Do it today" moves it to today in one tap; "Move to another day" picks any allowed day. On a day that already has a session, the athlete chooses to swap the two sessions' days or do both that day (at most two sessions a day; done or started sessions can't be swapped). Before moving, the server runs the plan checker's day-placement rules (rest day, availability, double days, hard runs back to back, heavy legs near a key run, legs after a key run, heavy legs back to back) on the week before and after, and explains anything the move newly breaks in plain words; the athlete can move anyway. Day notes follow the move (a run and a lift on one day get "run first, then lift"). The week is saved when a session moves, so it no longer changes.
49. **Gym logging (part 2, step 2): changing exercises and progression.** During a workout, an exercise with nothing logged can be swapped for an alternative (the library's listed alternatives, then others for the same muscle group) that suits the athlete's equipment and avoids an injured area, or removed (a workout keeps at least one). Any library exercise matching the equipment can be added by search, planned as 3 working sets (5-8 reps for main lifts, 8-10 for other compounds, 10-12 for isolation) at RPE 8. Changes are saved to that session. Progression is double progression in code: if last time every planned working set was done and the sets at the top weight reached the top of the rep range at or under the target RPE (+0.5), the weight goes up one step (2.5 kg or 5 lb on barbells, 2 kg on dumbbells, 2.5 kg or 2.5 lb on machines); otherwise the weight stays and the target is one more rep (or all the sets, if some were missed). Bodyweight work progresses by reps. Recovery and taper weeks, an active injury and light sessions (every target RPE 7 or less) hold the weight. The suggested weight is pre-filled on working sets, the target reps shown, and a note on each exercise says why.
50. **The plan reacts to skips (check-ins part 3).** Missed sessions are never crammed in later, and skipping for work or life carries on as planned (the athlete can move sessions themselves). After a skip for illness or tiredness, the next two sessions not yet checked in (within a week of the skip) are eased: hard runs become easy runs of the same length, lifts keep their exercises with a note to go lighter, and each says why. At the start of a week, if less than 60% of last week's planned running was done (and at least two sessions were skipped or not checked in), Today offers to ease back in: the plan is rebuilt to carry on from the running actually done (and the longest run done), from this week if nothing in it has been checked in or moved yet, otherwise from next Monday. After illness, holiday or injury the first week back is easy running only. "Keep my plan" leaves it as it is; either answer is remembered so the offer isn't repeated for that week. While an injury is active, the injury rules adapt the plan instead. Skipping for injury points to reporting it (decision 43).
