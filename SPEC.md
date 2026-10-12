# ede. — Spec

## One-line pitch
Ede is an AI coach that builds and adapts weekly plans for people who lift and run, so the two support each other instead of clashing.

## Target user
Recreational hybrid athletes training 4-6 days a week, combining running and lifting, with a goal (race, strength target or general fitness) and a busy life.

## Core problem
Hybrid training creates interference: heavy leg days hurt run quality, long runs hurt lifting, and recovery gets squeezed. Most people follow two separate plans that don't talk to each other.

## Session types
Run, strength (lifting) and rest only. No swimming or cross-training.

## Core loop
1. Onboarding: goal, target date (optional), current weekly training, equipment, injury history, and the weekly availability grid (below)
2. AI plan generation: the AI generates each week's sessions in a structured format (type, duration, intensity, step-by-step details)
3. Plan checker: the app validates the AI's output against fixed rules and asks the AI to regenerate if a rule is broken
4. Session check-in: completed or skipped, effort (1-10), notes
5. Skip workout: the user picks a reason (injury, illness, holiday, work/life, fatigue, other) and the AI recalculates the plan around it
6. Weekly summary: what was done, what changed and why, what's next

## Weekly availability grid
- Monday to Sunday, each day set to Rest or an available time (e.g. 30, 45, 60, 90, 120+ minutes), so users can have longer sessions at weekends
- A "double day" toggle per day, allowing two sessions (one run, one lift), each with its own time length
- Summary showing training days, double days and full rest days (double days exist to create more full rest days)

## Session data model
A day holds one or two sessions. Each session has: type (run or strength), duration, intensity, planned vs actual, effort rating, and optional structured steps (warm-up, intervals, cool-down for runs; exercises, sets and reps for strength).

## Plan checker rules (enforced by the app, not the AI)
- Gradual weekly load progression, with a recovery week every 3-4 weeks
- No heavy leg session the day before a key run
- At least one full rest day per week
- Sessions fit within the time set for that day
- Double days are a run plus a lift only, never two hard sessions back to back, and no heavy legs on a double day that includes a key run
- Taper logic if a target date is set
- Cap on how much the plan can change in a single recalculation

## Skip workout behaviour
- Illness/injury: conservative return with a gradual ramp, no cramming missed sessions
- Injury: ask for body area and pain level; if severe or persistent, advise seeing a physio or doctor
- Holiday: ease back in on return
- Life/work: usually carry on without making up missed sessions
- Check-in notes are scanned for words like pain, dizzy or chest, which trigger cautious advice
- A short "not medical advice" notice appears in onboarding and the footer

## Garmin (stretch goal)
v1 shows each run clearly in the app with step details. Apply for Garmin's Training API early; add "send to watch" once approved.

## Out of scope for v1
Strava/Garmin data sync, nutrition tracking, payments, social features, a native mobile app, exercise video library

## Success criteria
5 real users complete 2 weeks of check-ins, and at least 3 say the plan adjustments felt sensible.
