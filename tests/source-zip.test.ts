import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSourceZip } from "../src/lib/source-zip";
import { SOURCE_LIMITS } from "../src/lib/versions";

function readZip(archive: Buffer) {
  const dir = mkdtempSync(join(tmpdir(), "nova-source-zip-"));
  const path = join(dir, "source.zip");
  writeFileSync(path, archive);
  try {
    return JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          `
import json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    assert archive.testzip() is None
    print(json.dumps({
      "files": {name: archive.read(name).decode("utf8") for name in archive.namelist()},
      "metadata": [{"path": x.filename, "method": x.compress_type, "flags": x.flag_bits, "mode": x.external_attr >> 16, "size": x.file_size} for x in archive.infolist()]
    }))
`,
          path,
        ],
        {
          encoding: "utf8",
          maxBuffer: SOURCE_LIMITS.totalBytes * 8,
          timeout: 10_000,
        },
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("complete source ZIP exports", () => {
  it("opens with a standard ZIP reader and preserves paths, Unicode, line endings and original source", () => {
    const files = [
      {
        path: "src/App.tsx",
        content: "export default () => <h1>مرحبا 🌙</h1>;\r\n",
      },
      { path: "package.json", content: '{"name":"workspace"}\n' },
      { path: "README.md", content: "No final newline" },
      { path: "public/index.html", content: "<script>doNotExecute()</script>" },
      { path: "src/empty.ts", content: "" },
    ];
    const result = readZip(buildSourceZip(files));
    expect(result.files).toEqual(
      Object.fromEntries(files.map((file) => [file.path, file.content])),
    );
    for (const info of result.metadata) {
      expect(info.method).toBe(0);
      expect(info.flags & 0x800).toBe(0x800);
      expect(info.mode).toBe(0o100644);
    }
  });
  it("produces a valid empty archive and deterministic bytes independent of input order", () => {
    expect(readZip(buildSourceZip([])).files).toEqual({});
    const files = [
      { path: "a.ts", content: "a" },
      { path: "b.ts", content: "b" },
    ];
    expect(buildSourceZip(files)).toEqual(buildSourceZip([...files].reverse()));
  });
  it.each([
    "../escape.ts",
    "/absolute.ts",
    "src/../../escape.ts",
    "src\\escape.ts",
    ".env",
    "node_modules/dependency.js",
    "data/private.json",
    "file.exe",
    "CON.txt",
    "",
  ])("rejects unsafe or unsupported export paths: %s", (path) => {
    expect(() => buildSourceZip([{ path, content: "text" }])).toThrow(
      expect.objectContaining({ code: "INVALID_PATH" }),
    );
  });
  it("rejects duplicate and conflicting file/directory paths regardless of case", () => {
    expect(() =>
      buildSourceZip([
        { path: "App.ts", content: "a" },
        { path: "app.ts", content: "b" },
      ]),
    ).toThrow(expect.objectContaining({ code: "INVALID_CHANGE" }));
    expect(() =>
      buildSourceZip([
        { path: "App.ts", content: "a" },
        { path: "app.ts/nested.ts", content: "b" },
      ]),
    ).toThrow(expect.objectContaining({ code: "INVALID_PATH" }));
  });
  it("enforces file/count/aggregate byte limits and refuses NUL content", () => {
    expect(() => buildSourceZip([{ path: "a.ts", content: "\0" }])).toThrow(
      expect.objectContaining({ code: "INVALID_CHANGE" }),
    );
    expect(() =>
      buildSourceZip([
        { path: "a.ts", content: "a".repeat(SOURCE_LIMITS.fileBytes + 1) },
      ]),
    ).toThrow(expect.objectContaining({ code: "LIMIT" }));
    expect(() =>
      buildSourceZip(
        Array.from({ length: SOURCE_LIMITS.files + 1 }, (_, i) => ({
          path: `${i}.ts`,
          content: "",
        })),
      ),
    ).toThrow(expect.objectContaining({ code: "LIMIT" }));
    expect(() =>
      buildSourceZip(
        Array.from({ length: 9 }, (_, i) => ({
          path: `${i}.ts`,
          content: "a".repeat(SOURCE_LIMITS.fileBytes),
        })),
      ),
    ).toThrow(expect.objectContaining({ code: "LIMIT" }));
  });
  it("round-trips a maximum-sized snapshot with checksum verification", () => {
    const files = Array.from({ length: 8 }, (_, i) => ({
      path: `src/${i}.ts`,
      content: "a".repeat(SOURCE_LIMITS.fileBytes),
    }));
    const archive = buildSourceZip(files);
    expect(archive.length).toBeLessThan(SOURCE_LIMITS.totalBytes + 4096);
    expect(
      Object.values(readZip(archive).files).map(
        (text) => (text as string).length,
      ),
    ).toEqual(Array(8).fill(SOURCE_LIMITS.fileBytes));
  });
});
