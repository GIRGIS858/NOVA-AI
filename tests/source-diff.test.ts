import { describe, expect, it } from "vitest";
import { sourceDiff } from "../src/lib/source-diff";

describe("source comparison", () => {
  it.each([
    ["", ""],
    ["", "hello\n"],
    ["hello", ""],
    ["a\nb\nc\n", "a\nnew\nc\n"],
    ["a\na\nb\n", "a\nb\na\n"],
    ["مرحبا 🌙\r\n", "مرحبا 🌙\n"],
    ["same\n", "same"],
    ["<script>alert(1)</script>", "<h1>safe text</h1>"],
    ["a\n".repeat(600), "b\n".repeat(600)],
  ])("preserves both complete inputs %#", (before, after) => {
    const diff = sourceDiff(before, after);
    expect(
      diff.lines
        .filter((l) => l.kind !== "added")
        .map((l) => l.text)
        .join(""),
    ).toBe(before);
    expect(
      diff.lines
        .filter((l) => l.kind !== "removed")
        .map((l) => l.text)
        .join(""),
    ).toBe(after);
  });
  it("keeps unchanged interior lines aligned", () => {
    expect(
      sourceDiff("a\nb\nc\nd\n", "x\nb\nc\ny\n")
        .lines.filter((l) => l.kind === "same")
        .map((l) => l.text),
    ).toEqual(["b\n", "c\n"]);
  });
  it("handles many blank lines without argument-stack overflow", () => {
    const before = "\n".repeat(150_000);
    const result = sourceDiff(before, "changed\n" + before);
    expect(
      result.lines
        .filter((line) => line.kind !== "removed")
        .map((line) => line.text)
        .join(""),
    ).toBe("changed\n" + before);
  });
  it("bounds work for large replacements", () => {
    expect(sourceDiff("a\n".repeat(600), "b\n".repeat(600)).coarse).toBe(true);
  });
});
