/**
 * Cross-platform db reset (Windows + macOS/Linux).
 */
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const dbPath = join(process.cwd(), "data", "greenroom.db");

if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log("Removed data/greenroom.db");
}

execSync("npx drizzle-kit push", { stdio: "inherit" });
execSync("npx tsx db/seed.ts", { stdio: "inherit" });

console.log("Database reset complete.");
