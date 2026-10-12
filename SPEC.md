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
- **Rotation and progression.** Quality sessions rotate (for example intervals, then tempo, then hills or fartlek), and a session type comes back at the same or a higher level. The same main hard session type is not used two weeks in a row.
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

## Session data model
A day holds one or two sessions. Each session has: type (run or strength), duration, intensity, planned vs actual, effort rating, and optional structured steps (warm-up, intervals, cool-down for runs; exercises, sets and reps for strength).

The plan engine's output also gives each session a key-session flag and a body focus (upper, lower, full, or none for runs); each strength exercise has warm-up sets, working sets, reps, target RPE and failure_allowed; each day has notes; and the week has a phase, run minutes, strength minutes and a coach note. The exact output format is in prompts/plan-engine.md.

## Plan checker rules (enforced by the app, not the AI)
- Gradual weekly load progression, with a recovery week every 3-4 weeks
- Weekly run minutes within about 10% above last week's run minutes (strength minutes don't count), with the starting-load exception above
- At least 80% of weekly running time is easy (counted from the planned minutes of runs marked easy)
- No heavy leg session the day before a key run
- No heavy lower-body session the day before, or the same day as, a hard or long run
- No hard run followed by a hard run, and no strength session followed by a strength session, on consecutive days
- At least one full rest day per week
- Sessions fit within the time set for that day
- Double days are a run plus a lift only, never two hard sessions back to back, and no heavy legs on a double day that includes a key run
- Working sets per exercise must match the strength volume setting
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
3. **Long run.** The week's longest run, if it is 60 minutes or more.
4. **Heavy lower-body.** A strength session with a lower body focus, or a full-body session with a lower-body exercise at RPE 8 or above. Until the exercise library exists, every exercise in a full-body session is treated as possibly lower-body.
5. **Key run.** "Key run" now means a hard or long run. The output's is_key_session is kept as the AI's own marker.
6. **Progression measure.** Only run minutes have a progression limit. Strength minutes have no separate limit in v1.
7. **Whole plan up front.** Code builds a plan outline for the whole plan right after onboarding; the AI fills in each week's details when it is due.
8. **Race distances.** 5K, 10K, half marathon, marathon and ultra (with a distance entered).
9. **No race date.** Rolling 8-week blocks that repeat, each with a recovery week.
10. **Strength variety.** Main lifts stay the same within a block; accessory exercises rotate.
11. **Ultra intensity.** Aim for about 90% easy running in ultra plans; the checker's 80% minimum still applies to all plans.
12. **Gym progression.** Code-based double progression sets next session's targets; the AI can hold it back and explains why.
