# ede. spec v4: additions to merge into SPEC.md

This file holds only what is NEW or CHANGED since the current SPEC.md. Ask Claude Code to merge it into SPEC.md and update the app to match, one step at a time. The AI plan-engine prompt lives in prompts/plan-engine.md.

## Pitch (add)
ede. combines the guided, goal-based running plan of a running coach app with the fast set-by-set logging of a lifting tracker, in one plan that manages both. Write the name as "ede." (lowercase, with the full stop) in the UI. Plain sentences can just say "ede".

## Strength volume setting (new)
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

## Coaching rules (new or changed)
- A hard run day can be followed by a hard gym day and vice versa. Two hard runs, or two strength sessions, are not placed on consecutive days.
- After a hard or long run, prefer upper body the next day. Lower-body lifting the day after a hard or long run is a fallback, at no more than RPE 8.
- No heavy lower-body lifting the day before, or the same day as, a hard or long run (extends the existing "day before a key run" rule).
- The 10% weekly progression limit applies to RUN minutes only, not total minutes.
- Starting load: if last week's run minutes are under 60 or missing, ignore the 10% rule and start at 40-60 run minutes (beginners, run/walk) or 60-90 (others), split across 2-3 sessions.

## Plan checker changes (code, with tests)
Add these to the existing rules:
- Working sets per exercise must match the strength volume setting
- failure_allowed only on machine, cable or isolation exercises
- Weekly run minutes within about 10% above last week's run minutes (with the starting-load exception above)
- No hard run followed by a hard run, and no strength session followed by a strength session, on consecutive days
- No heavy lower-body session the same day as a hard or long run
- Injury severity rules (see prompts/plan-engine.md): pain 0-3 reduces runs, 4-6 means no running, 7+ means no running and no lower-body lifting

## Injury input (change to skip-workout and onboarding)
Capture: area, pain level (0-10), and when it hurts (running, walking, resting, lifting only). Free-text notes are still scanned for words like pain, dizzy or chest.

## Logging (new: the "lifting tracker" side)
v1: strength sets logged as weight and reps per working set, with last session's numbers pre-filled and a rest timer; the AI adjusts next session's targets (progressive overload). Runs logged manually (distance, time, effort).
v2: Strava import, pace targets (needs a recent 5K time from onboarding), AI feedback after each workout, Garmin push once the Training API is approved.
v3: progress charts, personal records, history.
Skip: social feed, community, in-app GPS tracking, exercise videos.

## Data to add (stack-agnostic; implement in the existing Prisma schema)
- Profile: strength_volume (low, moderate, high), recent_5k_minutes (optional), injury area / pain level / pain_when
- Exercise library: name, muscle group, equipment, is_lower_body, failure_allowed
- Set logs: session, exercise, set number, is_warmup, planned reps and RPE, actual weight, reps and RPE
- Run logs: session, distance_km, duration_seconds, avg_heart_rate (optional), notes
- Weekly record: run_minutes and strength_minutes, so next week's plan can use last week's run minutes
