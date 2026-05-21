/**
 * Database client. Uses libsql for a pure-JS local SQLite — no native
 * compilation, no engine downloads, just a file at ./data/greenroom.db.
 *
 * In a real product this would point at a managed Postgres. For the case
 * study, file-based SQLite is enough — and a single file means seeded
 * data is committed to git, so candidates can clone-and-run.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "path";
import * as schema from "./schema";

/** Absolute path so Next dev and scripts always hit the same DB file. */
const defaultDbPath = path.join(process.cwd(), "data", "greenroom.db");
const dbUrl =
  process.env.DATABASE_URL ??
  `file:${defaultDbPath.replace(/\\/g, "/")}`;

export const client = createClient({ url: dbUrl });
export const db = drizzle(client, { schema });

export type DB = typeof db;
