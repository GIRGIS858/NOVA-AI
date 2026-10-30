import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generationQueue } from "./generation-queue";
import { generationStore } from "./generation-store";
import { projectStore } from "./projects";
import { sourceVersionStore } from "./versions";
import { staticSourceStore } from "./static-source";

const path = resolve(process.env.NOVA_DATABASE_PATH || "./data/nova.sqlite");
mkdirSync(dirname(path), { recursive: true });
export const db = new Database(path);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
export const projects = projectStore(db);
export const sourceVersions = sourceVersionStore(db);
export const staticSources = staticSourceStore(db);
export const generations = generationStore(db);

export const generationJobs = generationQueue(db);
