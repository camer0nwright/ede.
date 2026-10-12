// Fills the local database with one demo athlete and one week of sessions.
// Run with: npm run db:seed (it clears existing data first).
import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { Availability, WeekPlan } from "../src/lib/domain";

const db = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL! }),
});

// Monday to Sunday. Wednesday is a double day, Monday and Friday are rest.
const availability = Availability.parse([
  { minutes: null },
  { minutes: 60 },
  { minutes: 45, isDouble: true, secondMinutes: 45 },
  { minutes: 45 },
  { minutes: null },
  { minutes: 90 },
  { minutes: 60 },
]);

const week = WeekPlan.parse({
  weekStart: "2026-10-12",
  sessions: [
    {
      date: "2026-10-13",
      type: "strength",
      title: "Lower body strength",
      intensity: "hard",
      plannedMinutes: 60,
      isHeavyLegs: true,
      steps: [
        { name: "Back squat", sets: 4, reps: "5", load: "RPE 8", isLegs: true },
        { name: "Romanian deadlift", sets: 3, reps: "8", load: "RPE 7", isLegs: true },
        { name: "Plank", sets: 3, reps: "45s" },
      ],
    },
    {
      date: "2026-10-14",
      slot: 1,
      type: "run",
      title: "Easy run",
      intensity: "easy",
      plannedMinutes: 40,
      steps: [{ kind: "steady", minutes: 40, description: "Conversational pace" }],
    },
    {
      date: "2026-10-14",
      slot: 2,
      type: "strength",
      title: "Upper body strength",
      intensity: "moderate",
      plannedMinutes: 45,
      steps: [
        { name: "Bench press", sets: 4, reps: "6", load: "RPE 7" },
        { name: "Pull-ups", sets: 4, reps: "6-8" },
      ],
    },
    {
      date: "2026-10-15",
      type: "run",
      title: "Intervals",
      intensity: "hard",
      plannedMinutes: 45,
      isKeyRun: true,
      steps: [
        { kind: "warmup", minutes: 12, description: "Easy jog plus 4 strides" },
        { kind: "interval", minutes: 4, repeat: 4, description: "Hard, about 10k pace" },
        { kind: "recovery", minutes: 2, repeat: 4, description: "Walk or very easy jog" },
        { kind: "cooldown", minutes: 9, description: "Easy jog" },
      ],
    },
    {
      date: "2026-10-17",
      type: "run",
      title: "Long run",
      intensity: "moderate",
      plannedMinutes: 85,
      isKeyRun: true,
      steps: [{ kind: "steady", minutes: 85, description: "Steady, finish feeling strong" }],
    },
    {
      date: "2026-10-18",
      type: "strength",
      title: "Full body, light legs",
      intensity: "moderate",
      plannedMinutes: 50,
      steps: [
        { name: "Overhead press", sets: 3, reps: "8" },
        { name: "Goblet squat", sets: 3, reps: "10", load: "Light", isLegs: true },
      ],
    },
  ],
});

async function main() {
  await db.athlete.deleteMany();

  const athlete = await db.athlete.create({
    data: {
      name: "Demo athlete",
      goalType: "race",
      goalDetail: "Half marathon under 1:50",
      targetDate: new Date("2027-03-14"),
      currentTraining: "3 runs and 2 gym sessions a week",
      equipment: "Full gym",
      availability: {
        create: availability.map((d, dayOfWeek) => ({ dayOfWeek, ...d })),
      },
      weeks: {
        create: {
          weekStart: new Date(week.weekStart),
          weekNumber: 1,
          sessions: {
            create: week.sessions.map((s) => ({
              date: new Date(s.date),
              slot: s.slot,
              type: s.type,
              title: s.title,
              intensity: s.intensity,
              plannedMinutes: s.plannedMinutes,
              isKeyRun: s.type === "run" && s.isKeyRun,
              isHeavyLegs: s.type === "strength" && s.isHeavyLegs,
              steps: JSON.stringify(s.steps),
            })),
          },
        },
      },
    },
    include: { weeks: { include: { sessions: true } } },
  });

  console.log(
    `Seeded ${athlete.name} with ${athlete.weeks[0].sessions.length} sessions.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
