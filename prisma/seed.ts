// Fills the local database with the exercise library, plus one demo athlete
// with their plan outline and first week. Run with: npm run db:seed (it clears
// the demo athlete's data first).
import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { exerciseToRow, sessionToRow, toDbDate, weekToRow } from "../src/lib/db-mapping";
import { DEMO_ATHLETE, demoOutline, demoOutlineInput } from "../src/lib/demo-athlete";
import { demoWeek } from "../src/lib/demo-week";
import { EXERCISES } from "../src/lib/exercise-library";

const db = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL! }),
});

async function main() {
  // Exercise library: create or update every exercise from the code library.
  for (const e of EXERCISES) {
    const row = exerciseToRow(e);
    await db.exercise.upsert({ where: { name: e.name }, create: row, update: row });
  }

  await db.athlete.deleteMany();
  const input = demoOutlineInput;
  const athlete = await db.athlete.create({
    data: {
      name: DEMO_ATHLETE.name,
      goalType: input.goalType,
      goalDetail: DEMO_ATHLETE.goal,
      targetDate: input.targetDate ? toDbDate(input.targetDate) : null,
      raceDistance: input.raceDistance ?? null,
      experienceLevel: input.experienceLevel,
      strengthVolume: input.strengthVolume,
      currentTraining: "3-4 runs and 2 gym sessions a week",
      lastWeekRunMinutes: input.lastWeekRunMinutes ?? null,
      equipment: "Full gym",
      availability: {
        create: input.availability.map((d, dayOfWeek) => ({ dayOfWeek, ...d })),
      },
      outlines: {
        create: { input: JSON.stringify(input), outline: JSON.stringify(demoOutline) },
      },
    },
    include: { outlines: true },
  });

  const week = await db.planWeek.create({
    data: {
      ...weekToRow(demoWeek),
      athleteId: athlete.id,
      outlineId: athlete.outlines[0].id,
      sessions: { create: demoWeek.sessions.map(sessionToRow) },
    },
    include: { sessions: true },
  });

  console.log(
    `Seeded ${EXERCISES.length} exercises, and ${athlete.name} with a ${demoOutline.weeks.length}-week plan and ${week.sessions.length} sessions in week 1.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
