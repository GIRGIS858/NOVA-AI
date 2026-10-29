import sanitize from "sanitize-html";

export function staticPreview(source: string): string {
  const clean = sanitize(source, {
    allowedTags: [
      "html",
      "head",
      "body",
      "style",
      "title",
      "main",
      "header",
      "footer",
      "nav",
      "section",
      "article",
      "aside",
      "div",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "strong",
      "em",
      "b",
      "i",
      "small",
      "br",
      "hr",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "figure",
      "figcaption",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "button",
      "label",
    ],
    allowedAttributes: {
      "*": ["class", "id", "style", "dir", "lang", "role", "aria-label"],
      a: ["href"],
      img: ["src", "alt", "width", "height"],
      button: ["disabled"],
    },
    allowedSchemes: ["data"],
    allowProtocolRelative: false,
    allowVulnerableTags: true,
    transformTags: {
      a: (_tag, attrs) => ({
        tagName: "a",
        attribs: {
          ...attrs,
          href: /^#[A-Za-z0-9_-]*$/.test(attrs.href || "") ? attrs.href : "#",
        },
      }),
      img: (_tag, attrs) => ({
        tagName: "img",
        attribs: {
          ...attrs,
          src: /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(
            attrs.src || "",
          )
            ? attrs.src
            : "",
        },
      }),
      button: (_tag, attrs) => ({
        tagName: "button",
        attribs: { ...attrs, disabled: "" },
      }),
    },
  });
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${clean}</body></html>`;
}
