import {
  extractHtmlMetadata,
  extractJsonLd,
  extractProductJsonLd,
  extractPageText,
  MAX_TEXT_LENGTH,
} from "./services/scraper/html-extractor.service.js";

const html = `
<html>
  <head>
    <title>Example Product</title>

    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Example CRM",
        "description": "CRM software for businesses"
      }
    </script>

    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Example Inc."
      }
    </script>

    <script type="application/ld+json">
      { invalid json }
    </script>
    <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "name": "Example Inc."
    },
    {
      "@type": "Product",
      "name": "Example CRM",
      "description": "CRM software for businesses"
    }
  ]
}
</script>
  </head>
</html>
`;

console.log("Metadata:");
console.log(extractHtmlMetadata(html, "https://example.com/"));

console.log("\nJSON-LD:");
console.log(extractJsonLd(html));

console.log("\nProduct JSON-LD:");
console.log(extractProductJsonLd(html));

import assert from "node:assert/strict";

// Extract products
const products = extractProductJsonLd(html);

console.log("\nExtracted Products:");
console.dir(products, { depth: null });

// Test 1: Direct Product
assert.equal(products[0].name, "Example CRM");

// Test 2: Product inside @graph
assert.equal(products[1].name, "Example CRM");

// Test 3: Only two products should be extracted
assert.equal(products.length, 2);

console.log("\nAll Product JSON-LD tests passed!");

// ---------------------------------------------------------------------------
// B2B product shapes seen on real vendor pages
// ---------------------------------------------------------------------------

const wrap = (...blocks) =>
  blocks
    .map(
      (b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`,
    )
    .join("\n");

const names = (html) => extractProductJsonLd(html).map((p) => p.name);

const b2bCases = [
  // --- Product types used by SaaS / software vendors ---
  {
    label: "SoftwareApplication",
    html: wrap({ "@type": "SoftwareApplication", name: "Acme CRM" }),
    expected: ["Acme CRM"],
  },
  {
    label: "WebApplication",
    html: wrap({ "@type": "WebApplication", name: "Acme Web" }),
    expected: ["Acme Web"],
  },
  {
    label: "MobileApplication",
    html: wrap({ "@type": "MobileApplication", name: "Acme Mobile" }),
    expected: ["Acme Mobile"],
  },
  {
    label: "Service (managed / hosted offering)",
    html: wrap({ "@type": "Service", name: "Acme Managed Hosting" }),
    expected: ["Acme Managed Hosting"],
  },

  // --- Shape variations ---
  {
    label: "array @type",
    html: wrap({ "@type": ["Product", "SoftwareApplication"], name: "Multi" }),
    expected: ["Multi"],
  },
  {
    label: "full schema.org IRI as @type",
    html: wrap({
      "@type": "https://schema.org/SoftwareApplication",
      name: "IRI",
    }),
    expected: ["IRI"],
  },
  {
    label: "schema: prefixed @type",
    html: wrap({ "@type": "schema:WebApplication", name: "Prefixed" }),
    expected: ["Prefixed"],
  },
  {
    label: "top-level array",
    html: wrap([
      { "@type": "Organization", name: "Acme Inc." },
      { "@type": "SoftwareApplication", name: "Acme CRM" },
    ]),
    expected: ["Acme CRM"],
  },
  {
    label: "nested @graph",
    html: wrap({
      "@graph": [{ "@graph": [{ "@type": "WebApplication", name: "Deep" }] }],
    }),
    expected: ["Deep"],
  },
  {
    label: "WebPage with mainEntity",
    html: wrap({
      "@type": "WebPage",
      name: "Acme CRM | Product page",
      mainEntity: { "@type": "SoftwareApplication", name: "Acme CRM" },
    }),
    expected: ["Acme CRM"],
  },
  {
    label: "Yoast-style @graph with WebSite, WebPage, BreadcrumbList",
    html: wrap({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", name: "Acme" },
        { "@type": "WebPage", name: "Acme CRM" },
        { "@type": "BreadcrumbList", itemListElement: [] },
        { "@type": "Organization", name: "Acme Inc." },
        { "@type": "SoftwareApplication", name: "Acme CRM" },
      ],
    }),
    expected: ["Acme CRM"],
  },

  // --- Ranking: most specific software type comes first ---
  {
    label: "SoftwareApplication ranked above generic Product",
    html: wrap(
      { "@type": "Product", name: "Pro plan" },
      { "@type": "SoftwareApplication", name: "Acme CRM" },
    ),
    expected: ["Acme CRM", "Pro plan"],
  },

  // --- Robustness: must never crash ---
  {
    label: "null and primitives inside @graph",
    html: wrap({
      "@graph": [null, 42, "text", { "@type": "Product", name: "Safe" }],
    }),
    expected: ["Safe"],
  },
  {
    label: "missing @type",
    html: wrap({ name: "No type" }),
    expected: [],
  },
  {
    label: "non-string @type",
    html: wrap({ "@type": 123, name: "Bad type" }),
    expected: [],
  },
  {
    label: "invalid JSON block next to a valid one",
    html:
      `<script type="application/ld+json">{ broken </script>` +
      wrap({ "@type": "SoftwareApplication", name: "Survivor" }),
    expected: ["Survivor"],
  },

  // --- Pages with no product data (thin pages) ---
  {
    label: "only Organization / FAQPage / WebSite",
    html: wrap(
      { "@type": "Organization", name: "Acme Inc." },
      { "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Q?" }] },
      { "@type": "WebSite", name: "Acme" },
    ),
    expected: [],
  },
  {
    label: "no JSON-LD at all",
    html: "<html><head><title>Plain page</title></head></html>",
    expected: [],
  },
];

let failed = 0;

console.log("\nB2B product JSON-LD cases:");

for (const { label, html: caseHtml, expected } of b2bCases) {
  try {
    assert.deepEqual(names(caseHtml), expected);
    console.log(`  ✓ ${label}`);
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${label}\n      ${error.message.split("\n")[0]}`);
  }
}

console.log(
  failed
    ? `\n${failed} of ${b2bCases.length} B2B cases failed.`
    : `\nAll ${b2bCases.length} B2B cases passed!`,
);

// ---------------------------------------------------------------------------
// Page text extraction
// ---------------------------------------------------------------------------

// Long enough (> 500 chars) to read as real page content, not a banner.
const longParagraph = (word) => "<p>" + (word + " ").repeat(100) + "</p>";

const textCases = [
  {
    label: "blocks are separated and structure is kept",
    html: `<body><main>
      <h1>Acme CRM</h1><p>Sell faster.</p>
      <h2>Features</h2><ul><li>Pipelines</li><li>Reports</li></ul>
      ${longParagraph("filler")}
    </main></body>`,
    check: ({ text }) => {
      assert.match(
        text,
        /^# Acme CRM\nSell faster\.\n# Features\n- Pipelines\n- Reports\n/,
      );
    },
  },
  {
    label: "adjacent divs do not merge words",
    html: `<body><h2>Features</h2><div>Fast</div><div>Secure</div></body>`,
    check: ({ text }) => assert.equal(text, "# Features\nFast\nSecure"),
  },
  {
    label: "<br> becomes a line break",
    html: `<body><p>Line one<br>Line two</p></body>`,
    check: ({ text }) => assert.equal(text, "Line one\nLine two"),
  },

  {
    label: "header content is preserved while nav and footer are removed",
    html: `<body>
    <header>
      <h1>Acme CRM</h1>
      <p>Customer management for growing teams.</p>
    </header>

    <nav>Home Pricing</nav>
    <aside>Related posts</aside>
    <form><label>Email</label></form>
    <iframe>embedded</iframe>
    <div hidden>secret</div>
    <div aria-hidden="true">icon</div>
    <footer>© Acme</footer>
  </body>`,
    check: ({ text }) => {
      assert.equal(text, "# Acme CRM\nCustomer management for growing teams.");
    },
  },

  {
    label: "cookie / consent banners are removed",
    html: `<body>
      <div id="CookieBanner">We use cookies. Accept all</div>
      <div class="consent-modal">Manage consent</div>
      <h1>Acme</h1>
    </body>`,
    check: ({ text }) => assert.equal(text, "# Acme"),
  },
  {
    label: "large wrapper with 'cookie' in its class is NOT removed",
    html: `<body><div class="has-cookie-bar"><h1>Acme</h1>${longParagraph("content")}</div></body>`,
    check: ({ text }) => assert.match(text, /^# Acme\ncontent/),
  },
  {
    label: "<main> is preferred when it has real content",
    html: `<body><div>Outside promo</div><main><h1>Acme</h1>${longParagraph("inside")}</main></body>`,
    check: ({ text }) => {
      assert.ok(!text.includes("Outside promo"));
      assert.match(text, /^# Acme/);
    },
  },
  {
    label: "falls back to <body> when <main> is only a hero",
    html: `<body><main><h1>Acme</h1></main><section><h2>Features</h2><p>Reports</p></section></body>`,
    check: ({ text }) => assert.equal(text, "# Acme\n# Features\nReports"),
  },
  {
    label: "repeated lines are dropped",
    html: `<body><p>Book a demo</p><p>Acme CRM</p><p>Book a demo</p></body>`,
    check: ({ text }) => assert.equal(text, "Book a demo\nAcme CRM"),
  },
  {
    label: "long pages are capped at a line boundary and flagged",
    html: `<body>${Array.from({ length: 2000 }, (_, i) => `<p>Line number ${i}</p>`).join("")}</body>`,
    check: ({ text, truncated }) => {
      assert.ok(text.length <= MAX_TEXT_LENGTH);
      assert.equal(truncated, true);
      assert.match(text, /Line number \d+$/);
    },
  },
  {
    label: "short pages are not flagged as truncated",
    html: `<body><p>Short</p></body>`,
    check: ({ truncated }) => assert.equal(truncated, false),
  },
  {
    label: "JS-rendered shell is detected",
    html: `<body><div id="root"></div><script>render()</script></body>`,
    check: ({ text, likelyJsRendered }) => {
      assert.equal(text, "");
      assert.equal(likelyJsRendered, true);
    },
  },
  {
    label: "server-rendered React page is NOT flagged as JS-rendered",
    html: `<body><div id="__next"><h1>Acme</h1>${longParagraph("rendered")}</div></body>`,
    check: ({ likelyJsRendered }) => assert.equal(likelyJsRendered, false),
  },
  {
    label: "empty input does not crash",
    html: "",
    check: (result) =>
      assert.deepEqual(result, {
        text: "",
        truncated: false,
        likelyJsRendered: false,
      }),
  },
];

let textFailed = 0;

console.log("\nPage text cases:");

for (const { label, html: caseHtml, check } of textCases) {
  try {
    check(extractPageText(caseHtml));
    console.log(`  ✓ ${label}`);
  } catch (error) {
    textFailed += 1;
    console.log(`  ✗ ${label}\n      ${error.message.split("\n")[0]}`);
  }
}

console.log(
  textFailed
    ? `\n${textFailed} of ${textCases.length} page text cases failed.`
    : `\nAll ${textCases.length} page text cases passed!`,
);

process.exitCode = failed || textFailed ? 1 : 0;
