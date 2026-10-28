import { describe, expect, it } from "vitest";
import {
  buildPreview,
  validateFiles,
  ArtifactValidationError,
  STATIC_PREVIEW_CSP,
} from "../src/lib/static-artifact";

function files(html = "<h1>Hello</h1>", css = "h1 { color: teal; }") {
  return [
    { path: "index.html", content: html },
    { path: "styles.css", content: css },
  ];
}

describe("static source artifact boundary", () => {
  it("accepts exactly the supported files and normalizes their order", () => {
    expect(validateFiles(files().reverse())).toEqual(files());
    expect(validateFiles(files("<p>Valid</p>", ""))).toHaveLength(2);
  });
  it("rejects unsupported, duplicated, traversal, and malformed paths", () => {
    for (const path of [
      "../index.html",
      "/index.html",
      "index.HTML",
      "styles.css/..",
      "app.js",
      "index.html\0",
    ]) {
      expect(() =>
        validateFiles([{ path, content: "hello" }, files()[1]]),
      ).toThrow(ArtifactValidationError);
    }
    for (const value of [
      null,
      {},
      [],
      [files()[0]],
      [files()[0], files()[0]],
      [...files(), { path: "app.js", content: "" }],
      [{ path: "index.html", content: 42 }, files()[1]],
      [{ ...files()[0], extra: true }, files()[1]],
    ]) {
      expect(() => validateFiles(value)).toThrow(ArtifactValidationError);
    }
  });
  it("enforces byte limits, nonempty HTML, and null-byte rejection before sanitizing", () => {
    expect(() => validateFiles(files(" "))).toThrow(ArtifactValidationError);
    expect(() => validateFiles(files("<p>\0</p>"))).toThrow(
      ArtifactValidationError,
    );
    expect(() => validateFiles(files("<p>Hello</p>", "\0"))).toThrow(
      ArtifactValidationError,
    );
    expect(() => validateFiles(files("ع".repeat(52 * 1024)))).toThrow(
      ArtifactValidationError,
    );
    expect(() =>
      validateFiles(files("x".repeat(80 * 1024), "y".repeat(41 * 1024))),
    ).toThrow(ArtifactValidationError);
    expect(() => buildPreview(files("x".repeat(101 * 1024)))).toThrow(
      ArtifactValidationError,
    );
  });
});

describe("static preview document", () => {
  it("rejects artifacts that sanitize to no useful text or allowed image", () => {
    for (const html of [
      "<script>alert('not visible')</script>",
      "<head><title>Only a title</title></head>",
      "<template><h1>Removed text</h1></template>",
      "<svg><text>Removed text</text></svg>",
      '<main><section class="css-shape"></section><br><hr></main>',
      '<img src="https://outside.test/image.png" alt="Removed image">',
      '<img src="data:image/svg+xml;base64,PHN2Zz4=">',
      "<p> &#32; &nbsp; &#x200b; &ZeroWidthSpace; </p>",
      "<!-- Only a comment -->",
    ]) {
      expect(() => buildPreview(files(html))).toThrow(ArtifactValidationError);
    }
    expect(buildPreview(files("<p>&amp;</p>"))).toContain("<p>&amp;</p>");
    expect(buildPreview(files("Plain text without markup"))).toContain(
      "Plain text without markup",
    );
    expect(
      buildPreview(
        files('<img src="data:image/png;base64,aGVsbG8=" alt="Only image">'),
      ),
    ).toContain('src="data:image/png;base64,aGVsbG8="');
  });
  it("retains semantic content and valid language direction, replacing the supplied head", () => {
    const preview = buildPreview(
      files(
        '<!doctype html><html lang="ar" dir="rtl"><head><title>Hidden title</title><link rel="stylesheet" href="https://evil.test/x.css"></head><body><main class="hero"><h1>مرحبا</h1><a href="#details">More</a><section id="details">Details</section></main></body></html>',
      ),
    );
    expect(preview).toContain('<html lang="ar" dir="rtl">');
    expect(preview).toContain('<main class="hero"><h1>مرحبا</h1>');
    expect(preview).toContain('href="about:srcdoc#details"');
    expect(preview).not.toContain("Hidden title");
    expect(preview).not.toContain("evil.test");
    expect(preview).toContain(STATIC_PREVIEW_CSP);
  });
  it("removes executable content, forms, event handlers, foreign namespaces, and navigation", () => {
    const preview = buildPreview(
      files(
        `<script>evil()</script><svg><script>svgEvil()</script><a href="https://evil.test">hidden</a></svg><math><mtext>hiddenMath</mtext></math><iframe src="https://evil.test">hiddenFrame</iframe><object data="https://evil.test">hiddenObject</object><meta http-equiv="refresh" content="0;url=https://evil.test"><base href="https://evil.test"><form action="https://evil.test"><input name="secret"><button>Go</button></form><div onclick="evil()" style="background:url(https://evil.test)">Safe</div><a href="javascript:evil()" target="_top" download>Unsafe</a><a href="https://evil.test" ping="https://evil.test">External</a>`,
      ),
    );
    expect(preview).not.toMatch(
      /<script|<svg|<math|<iframe|<object|<form|<input|<button|onclick=|target=|download|ping=/i,
    );
    expect(preview).not.toContain("evil.test");
    expect(preview).not.toContain("hiddenMath");
    expect(preview).not.toContain("hiddenFrame");
    expect(preview).not.toContain("hiddenObject");
    expect(preview).toContain("Safe");
  });
  it("allows only raster data images and local fragment links, including entity-encoded attacks", () => {
    const preview = buildPreview(
      files(
        '<img src="data:image/png;base64,aGVsbG8=" alt="Example" width="200"><img src="data:image/svg+xml;base64,PHN2Zz4="><img src="//evil.test/image"><img src="https://evil.test/image"><a href="&#106;avascript:alert(1)">JS</a><a href="&#104;ttps://evil.test">URL</a><a href="#عنّا">About</a><a href="about:blank">Direct about</a>',
      ),
    );
    expect(preview).toContain('src="data:image/png;base64,aGVsbG8="');
    expect(preview).not.toContain("image/svg+xml");
    expect(preview).not.toContain("evil.test");
    expect(preview).not.toContain("javascript:");
    expect(preview).not.toContain("about:blank");
    expect(preview).toContain('href="about:srcdoc#عنّا"');
  });
  it("prevents stylesheet escape and bounds attributes while retaining static CSS", () => {
    const preview = buildPreview(
      files(
        `<p id="${"x".repeat(129)}" class="${"x".repeat(1025)}" lang='en" x="y' dir="bogus">Content</p>`,
        '</style><script>evil()</script><img src="https://evil.test"> body{color:red}',
      ),
    );
    expect(preview.match(/<style>/g)).toHaveLength(1);
    expect(preview.match(/<\/style>/g)).toHaveLength(1);
    expect(preview).not.toContain("<script>");
    expect(preview).not.toContain('<img src="https://evil.test">');
    expect(preview).toContain("body{color:red}");
    expect(preview).toContain("<p>Content</p>");
    expect(preview).toContain('<html lang="en" dir="auto">');
  });
  it("sanitizes malformed HTML without letting a generated policy precede its policy", () => {
    const preview = buildPreview(
      files(
        '<div><p>Visible</div><meta http-equiv="Content-Security-Policy" content="default-src *"><a href=" / /evil.test ">Link</a><template><script>evil()</script></template>',
      ),
    );
    expect(preview.match(/http-equiv="Content-Security-Policy"/g)).toHaveLength(
      1,
    );
    expect(preview).not.toContain("default-src *");
    expect(preview).not.toContain("<template");
    expect(preview).toContain("Visible");
  });
});
