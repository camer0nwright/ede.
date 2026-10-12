// Fills the local database with one demo athlete and one week of sessions.
// Run with: npm run db:seed (it clears existing data first).
import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { demoAvailability as availability, demoWeek as week } from "../src/lib/demo-week";

const db = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL! }),
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
