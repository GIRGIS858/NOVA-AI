import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { projectStore } from "./projects";
import { sourceVersionStore } from "./versions";

const path = resolve(process.env.NOVA_DATABASE_PATH || "./data/nova.sqlite");
mkdirSync(dirname(path), { recursive: true });
export const db = new Database(path);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
export const projects = projectStore(db);
export const sourceVersions = sourceVersionStore(db);
