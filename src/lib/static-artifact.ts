import sanitizeHtml from "sanitize-html";

export type SourceFile = { path: string; content: string };

export const STATIC_PREVIEW_CSP =
  "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'";

const MAX_FILE_BYTES = 100 * 1024;
const MAX_BUNDLE_BYTES = 120 * 1024;
const FILE_PATHS = ["index.html", "styles.css"] as const;

export class ArtifactValidationError extends Error {
  readonly code = "invalid_artifact";
  constructor() {
    super(
      "The generated files do not match the supported static website format.",
    );
    this.name = "ArtifactValidationError";
  }
}

/** Only two in-memory files are supported. Paths are never used on the filesystem. */
export function validateFiles(input: unknown): SourceFile[] {
  if (!Array.isArray(input) || input.length !== FILE_PATHS.length) {
    throw new ArtifactValidationError();
  }
  const files = new Map<string, string>();
  let totalBytes = 0;
  for (const item of input) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).some((key) => key !== "path" && key !== "content") ||
      typeof item.path !== "string" ||
      !FILE_PATHS.includes(item.path as (typeof FILE_PATHS)[number]) ||
      files.has(item.path) ||
      typeof item.content !== "string" ||
      item.content.includes("\0") ||
      (item.path === "index.html" && !item.content.trim())
    ) {
      throw new ArtifactValidationError();
    }
    const bytes = Buffer.byteLength(item.content, "utf8");
    totalBytes += bytes;
    if (bytes > MAX_FILE_BYTES || totalBytes > MAX_BUNDLE_BYTES) {
      throw new ArtifactValidationError();
    }
    files.set(item.path, item.content);
  }
  return FILE_PATHS.map((path) => ({ path, content: files.get(path)! }));
}

const ALLOWED_TAGS = [
  "main",
  "section",
  "article",
  "aside",
  "header",
  "footer",
  "nav",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "div",
  "span",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "a",
  "img",
  "figure",
  "figcaption",
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "small",
  "sub",
  "sup",
  "br",
  "hr",
  "blockquote",
  "pre",
  "code",
  "time",
  "abbr",
  "address",
];
const ALLOWED_ATTRIBUTES = {
  "*": ["class", "id", "title", "lang", "dir"],
  a: ["href"],
  img: ["src", "alt", "width", "height"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
  time: ["datetime"],
};
const language = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
const fragment = /^#[\p{L}\p{M}\p{N}_.:-]*$/u;
const rasterData =
  /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/]+={0,2}$/i;

function safeAttributes(attributes: Record<string, string>) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value.length > 1024 && key !== "src") continue;
    if (/[\u0000-\u001f\u007f]/.test(value)) continue;
    if (key === "href" && !fragment.test(value)) continue;
    if (key === "src" && !rasterData.test(value)) continue;
    if (key === "lang" && !language.test(value)) continue;
    if (key === "dir" && !["rtl", "ltr", "auto"].includes(value)) continue;
    if (
      ["width", "height", "colspan", "rowspan"].includes(key) &&
      !/^[1-9]\d{0,3}$/.test(value)
    )
      continue;
    if (key === "id" && (value.length > 128 || /\s/.test(value))) continue;
    // srcdoc inherits the parent URL as its base. A bare fragment would navigate
    // the frame to the application route instead of scrolling this document.
    result[key] = key === "href" ? `about:srcdoc${value}` : value;
  }
  return result;
}

/**
 * Build a static document, not executable application code. Always embed it in
 * an iframe with sandbox="" and referrerPolicy="no-referrer". Do not serve this
 * string as unsandboxed application-origin HTML or use dangerouslySetInnerHTML.
 */
export function buildPreview(input: SourceFile[]): string {
  const files = validateFiles(input);
  let lang = "en";
  let dir = "auto";
  const body = sanitizeHtml(files[0].content, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: [],
    allowedSchemesByTag: { img: ["data"], a: ["about"] },
    allowProtocolRelative: false,
    // Drop dangerous subtrees, including HTML head contents and foreign namespaces.
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "noscript",
      "head",
      "title",
      "iframe",
      "svg",
      "math",
      "object",
      "embed",
      "template",
    ],
    transformTags: {
      "*": (tagName, attribs) => {
        const safe = safeAttributes(attribs);
        if (tagName === "html" || tagName === "body") {
          if (safe.lang) lang = safe.lang;
          if (safe.dir) dir = safe.dir;
          return { tagName: "div", attribs: safe };
        }
        return { tagName, attribs: safe };
      },
    },
    enforceHtmlBoundary: false,
  });
  // CSS is untrusted too: a literal closing style tag must never become HTML.
  // Network loads (including @import and url()) are denied by the document CSP.
  const css = files[1].content.replaceAll("<", "\\3c ");
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta http-equiv="Content-Security-Policy" content="${STATIC_PREVIEW_CSP}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><style>html{overflow-wrap:anywhere}img{max-width:100%;height:auto}${css}</style></head><body>${body}</body></html>`;
}
