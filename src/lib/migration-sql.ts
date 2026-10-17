// Splitting a Prisma migration file into statements, for applying migrations
// to a hosted (Turso) database with scripts/deploy-db.ts.

/** A migration file as single statements. Foreign-key pragmas are left out: libSQL's migrate() turns the checks off itself. */
export function migrationStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s && !/^PRAGMA\s+(defer_)?foreign_keys/i.test(s));
}
