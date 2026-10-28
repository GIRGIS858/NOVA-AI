import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { projectStore } from "../src/lib/projects";

describe("project ownership and persistence", () => {
  let db: Database.Database;
  let store: ReturnType<typeof projectStore>;
  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    store = projectStore(db);
  });
  afterEach(() => db.close());
  it("isolates project reads, notes, and deletes between owners", () => {
    const id = store.create("alice", {
      name: "Private project",
      brief: "A private customer management application",
    });
    store.addMessage("alice", id, "Keep customer data private");
    expect(store.get("bob", id)).toBeUndefined();
    expect(store.list("bob")).toEqual([]);
    expect(store.messages("bob", id)).toEqual([]);
    expect(() => store.addMessage("bob", id, "Unauthorized change")).toThrow(
      "Project unavailable",
    );
    expect(store.remove("bob", id)).toBe(false);
    expect(store.messages("alice", id)).toHaveLength(1);
  });
  it("validates input before writing and treats text as data", () => {
    expect(() =>
      store.create("alice", { name: "x", brief: "short" }),
    ).toThrow();
    const id = store.create("alice", {
      name: "Alice's studio",
      brief: "<script>alert('hello')</script>",
    });
    expect(store.get("alice", id)?.brief).toBe(
      "<script>alert('hello')</script>",
    );
    expect(() => store.addMessage("alice", id, " ")).toThrow();
    expect(() => store.addMessage("alice", id, "x".repeat(8001))).toThrow();
    expect(store.list("alice")).toHaveLength(1);
  });
  it("deletes dependent notes atomically and keeps other projects", () => {
    const id = store.create("alice", {
      name: "First project",
      brief: "This is the first project",
    });
    const other = store.create("alice", {
      name: "Second project",
      brief: "This is the second project",
    });
    store.addMessage("alice", id, "Remove this note with its project");
    expect(store.remove("alice", id)).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS count FROM messages").get()).toEqual({
      count: 0,
    });
    expect(store.get("alice", other)).toBeDefined();
  });
});
