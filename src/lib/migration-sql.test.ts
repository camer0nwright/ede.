import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrationStatements } from "./migration-sql";

describe("migration statements", () => {
  it("splits on semicolons at line ends and drops comments", () => {
    const sql = `-- CreateTable\nCREATE TABLE "A" (\n  "id" TEXT\n);\n\n-- CreateIndex\nCREATE UNIQUE INDEX "A_id" ON "A"("id");\n`;
    expect(migrationStatements(sql)).toEqual([`CREATE TABLE "A" (\n  "id" TEXT\n)`, `CREATE UNIQUE INDEX "A_id" ON "A"("id")`]);
  });

  it("leaves out the foreign-key pragmas", () => {
    const sql = `PRAGMA defer_foreign_keys=ON;\nPRAGMA foreign_keys=OFF;\nDROP TABLE "A";\nPRAGMA foreign_keys=ON;\nPRAGMA defer_foreign_keys=OFF;\n`;
    expect(migrationStatements(sql)).toEqual([`DROP TABLE "A"`]);
  });

  it("reads every real migration into complete statements", () => {
    for (const dir of readdirSync("prisma/migrations").filter((d) => !d.includes("."))) {
      const statements = migrationStatements(readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"));
      expect(statements.length).toBeGreaterThan(0);
      for (const s of statements) expect(s).toMatch(/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/);
    }
  });
});
