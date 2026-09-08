import assert from "node:assert/strict";
import test from "node:test";

test("libSQL adapter preserves the prepared statement contract", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  delete process.env.TURSO_AUTH_TOKEN;
  const { getDatabase } = await import("../lib/database.ts");
  const db = getDatabase();

  await db.prepare("CREATE TABLE checks (id TEXT PRIMARY KEY, passed INTEGER NOT NULL)").run();
  await db.batch([
    db.prepare("INSERT INTO checks VALUES (?, ?)").bind("database", true),
    db.prepare("INSERT INTO checks VALUES (?, ?)").bind("storage", false),
  ]);

  const all = await db.prepare("SELECT * FROM checks ORDER BY id").all<{ id: string; passed: number }>();
  assert.deepEqual(all.results.map((row) => ({ ...row })), [
    { id: "database", passed: 1 },
    { id: "storage", passed: 0 },
  ]);
  const first = await db.prepare("SELECT id FROM checks WHERE passed = ?").bind(1).first<{ id: string }>();
  assert.equal(first?.id, "database");
});
