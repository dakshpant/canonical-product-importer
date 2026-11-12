// End-to-end tests for the scrape stage (robots.txt -> fetch -> extract ->
// content check), against local HTTP servers. No database, no internet.
//
// Run: node --experimental-test-module-mocks --test src/test-scrape-pipeline.js
import { test, mock, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// Local servers are on 127.0.0.1, which the SSRF guard blocks on purpose.
// Allow it for this test only.
mock.module("./services/scraper/network-safety.js", {
  exports: {
    resolvePublicAddress: async () => ({ address: "127.0.0.1", family: 4 }),
    isPublicUrl: async () => true,
  },
});

const { prepareExtractionInput, buildProductExtractionInput, MAX_JSON_LD_LENGTH } =
  await import("./services/scraper/product-extraction-input.service.js");
const { checkRobotsPermission, clearRobotsCache } = await import(
  "./services/scraper/robot.service.js"
);

const LONG_TEXT = "Acme CRM helps sales teams track deals and contacts. ".repeat(10);

const productPage = `<!doctype html><html><head><title>Acme CRM</title></head>
<body><main><h1>Acme CRM</h1><p>${LONG_TEXT}</p>
<p><a href="/start">Get started</a><a href="/demo">Request a demo</a></p>
<p>Read <a href="/docs">our docs</a>.</p>
<ul><li></li><li>Contact management</li></ul></main></body></html>`;

const thinPage = `<html><head><title>Login</title></head><body><h1>Sign in</h1></body></html>`;
const jsShell = `<html><head><title>App</title></head><body><div id="root"></div></body></html>`;

const reviews = Array.from({ length: 200 }, (_, i) => ({
  "@type": "Review",
  reviewBody: `Review number ${i} `.repeat(20),
}));
const jsonLdOnly = `<html><head><title>X</title><script type="application/ld+json">${JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Acme CRM",
    review: reviews,
    featureList: Array.from({ length: 50 }, (_, i) => `Feature ${i}`),
  },
)}</script></head><body><p>Tiny</p></body></html>`;

let main;
let other;
let flaky;

function startServer(routes) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const route = routes[req.url];
      if (!route) {
        res.writeHead(404).end("not found");
        return;
      }
      const { status = 200, type = "text/html", body = "", headers = {} } = route(server);
      res.writeHead(status, { "content-type": type, ...headers }).end(body);
    });
    server.listen(0, "127.0.0.1", () => {
      server.base = `http://127.0.0.1:${server.address().port}`;
      resolve(server);
    });
  });
}

before(async () => {
  // Origin with robots rules; "other" is a second origin for cross-site redirects.
  other = await startServer({
    "/robots.txt": () => ({ type: "text/plain", body: "User-agent: *\nDisallow: /secret" }),
    "/secret": () => ({ body: productPage }),
    "/ok": () => ({ body: productPage }),
  });

  main = await startServer({
    "/robots.txt": () => ({ type: "text/plain", body: "User-agent: *\nDisallow: /private" }),
    "/product": () => ({ body: productPage }),
    "/private": () => ({ body: productPage }),
    "/to-private": () => ({ status: 302, headers: { location: "/private" } }),
    "/to-other-secret": () => ({ status: 302, headers: { location: `${other.base}/secret` } }),
    "/to-other-ok": () => ({ status: 302, headers: { location: `${other.base}/ok` } }),
    "/thin": () => ({ body: thinPage }),
    "/app": () => ({ body: jsShell }),
    "/jsonld": () => ({ body: jsonLdOnly }),
    "/image": () => ({ type: "image/png", body: "png" }),
    "/forbidden": () => ({ status: 403, body: "no" }),
    "/limited": () => ({ status: 429, body: "slow down" }),
    "/broken": () => ({ status: 500, body: "oops" }),
  });

  // Origin whose robots.txt answer is configured per test.
  flaky = await startServer({
    "/robots.txt": (server) => ({ status: server.robotsStatus, type: "text/plain" }),
    "/product": () => ({ body: productPage }),
  });
});

after(() => {
  main.close();
  other.close();
  flaky.close();
});

async function expectCode(url, code) {
  await assert.rejects(prepareExtractionInput(url), (error) => {
    assert.equal(error.code, code, `${url}: ${error.message}`);
    return true;
  });
}

test("good page produces the full LLM input", async () => {
  const input = await prepareExtractionInput(`${main.base}/product`);

  assert.equal(input.url, `${main.base}/product`);
  assert.equal(input.metadata.title, "Acme CRM");
  assert.equal(input.signals.hasStructuredData, false);
  assert.ok(input.signals.textLength >= 200);
});

test("inline links are not glued together and punctuation stays attached", () => {
  const { pageText } = buildProductExtractionInput(productPage, "https://acme.test/");

  assert.match(pageText.text, /^Get started Request a demo$/m);
  assert.match(pageText.text, /^Read our docs\.$/m);
  assert.doesNotMatch(pageText.text, /^-$/m, "empty list item should be dropped");
});

test("robots.txt blocks a disallowed page", async () => {
  await expectCode(`${main.base}/private`, "DISALLOWED_BY_ROBOTS_TXT");
});

test("redirect to a disallowed path on the same site is blocked", async () => {
  await expectCode(`${main.base}/to-private`, "DISALLOWED_BY_ROBOTS_TXT");
});

test("redirect to a disallowed path on another site is blocked", async () => {
  await expectCode(`${main.base}/to-other-secret`, "DISALLOWED_BY_ROBOTS_TXT");
});

test("redirect to an allowed page on another site works", async () => {
  const input = await prepareExtractionInput(`${main.base}/to-other-ok`);
  assert.equal(input.url, `${other.base}/ok`);
  assert.equal(input.requestedUrl, `${main.base}/to-other-ok`);
});

test("robots.txt 4xx (other than 401/403) means allowed", async () => {
  for (const status of [400, 404, 410]) {
    clearRobotsCache();
    flaky.robotsStatus = status;
    const permission = await checkRobotsPermission(`${flaky.base}/product`);
    assert.equal(permission.allowed, true, `robots.txt HTTP ${status}`);
  }
});

test("robots.txt 401/403/5xx means blocked", async () => {
  for (const status of [401, 403, 500, 503]) {
    clearRobotsCache();
    flaky.robotsStatus = status;
    const permission = await checkRobotsPermission(`${flaky.base}/product`);
    assert.equal(permission.allowed, false, `robots.txt HTTP ${status}`);
  }
});

test("robots.txt is cached per origin", async () => {
  clearRobotsCache();
  flaky.robotsStatus = 404;
  assert.equal((await checkRobotsPermission(`${flaky.base}/product`)).allowed, true);

  // Changes on the server are not seen until the cache expires.
  flaky.robotsStatus = 403;
  assert.equal((await checkRobotsPermission(`${flaky.base}/product`)).allowed, true);
  clearRobotsCache();
});

test("HTTP failures have error codes", async () => {
  await expectCode(`${main.base}/missing`, "HTTP_404");
  await expectCode(`${main.base}/forbidden`, "ACCESS_DENIED");
  await expectCode(`${main.base}/limited`, "RATE_LIMITED");
  await expectCode(`${main.base}/broken`, "HTTP_ERROR");
  await expectCode(`${main.base}/image`, "NOT_HTML");
});

test("thin pages are rejected before the LLM", async () => {
  await expectCode(`${main.base}/thin`, "INSUFFICIENT_CONTENT");
});

test("JS-rendered shells are rejected before the LLM", async () => {
  await expectCode(`${main.base}/app`, "JS_RENDERED");
});

test("structured data alone is enough, and is trimmed to budget", async () => {
  const input = await prepareExtractionInput(`${main.base}/jsonld`);
  const [node] = input.jsonLdProducts;

  assert.equal(node.name, "Acme CRM");
  assert.equal(node.review, undefined, "reviews are dropped");
  assert.equal(node["@context"], undefined);
  assert.equal(node.featureList.length, 10, "arrays are capped");
  assert.ok(JSON.stringify(input.jsonLdProducts).length <= MAX_JSON_LD_LENGTH);
});
