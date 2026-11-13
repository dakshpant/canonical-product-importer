// Tests for record / replay of LLM answers (running without an API key).
// No network and no database: a fake "live" client and a temp directory.
//
// Run: node --test tests/unit/recorded-client.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { AI_ERROR, AiExtractionError } from "../../src/services/ai/errors.js";
import { extractProduct } from "../../src/services/ai/extraction.service.js";
import {
  createLlmClient,
  createRecordingClient,
  createReplayClient,
  recordingPath,
} from "../../src/services/ai/recorded.client.js";
import { buildProductExtractionInput } from "../../src/services/scraper/product-extraction-input.service.js";
import {
  AI_PRODUCT_EXTRACTION_FIELDS,
  LIST_FIELDS,
} from "../../src/validators/product-extraction.validator.js";

const URL_A = "https://acme.example/crm";
const KEY = "gsk_testkey1234567890abcdef";

function tempDir(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "recordings-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function fakeLive(content = validAnswer(), model = "openai/gpt-oss-120b") {
  const calls = [];
  return {
    model,
    calls,
    async complete(messages) {
      calls.push(messages);
      if (content instanceof Error) throw content;
      return content;
    },
  };
}

// A minimal answer that passes validation, with optional field values.
function validAnswer(overrides = {}) {
  const base = Object.fromEntries(
    AI_PRODUCT_EXTRACTION_FIELDS.map((f) => [f, LIST_FIELDS.includes(f) ? [] : null]),
  );
  return JSON.stringify({ ...base, sources: [], ...overrides });
}

const rejectsWithCode = (promise, code) =>
  assert.rejects(promise, (error) => error instanceof AiExtractionError && error.code === code);

// ---------------------------------------------------------------------------
// File naming
// ---------------------------------------------------------------------------

test("recording file names are readable, stable and unique per URL", () => {
  const a = recordingPath(URL_A, "/rec");
  assert.equal(a, recordingPath(URL_A, "/rec"));
  assert.match(path.basename(a), /^acme_example_crm_[0-9a-f]{8}\.json$/);
  assert.notEqual(a, recordingPath("https://acme.example/crm?x=1", "/rec"));
});

// ---------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------

test("recording saves exactly the live answer, and nothing else", async (t) => {
  const dir = tempDir(t);
  const answer = validAnswer({ name: "Acme CRM" });
  const live = fakeLive(answer);
  const client = createRecordingClient(URL_A, { dir, live, apiKey: KEY });

  const content = await client.complete([{ role: "user", content: "page" }]);

  assert.equal(content, answer);
  assert.equal(live.calls.length, 1);
  const saved = JSON.parse(readFileSync(recordingPath(URL_A, dir), "utf8"));
  assert.deepEqual(Object.keys(saved).sort(), ["content", "model", "recorded_at", "url"]);
  assert.equal(saved.content, answer);
  assert.equal(saved.url, URL_A);
  assert.equal(saved.model, "openai/gpt-oss-120b");
});

test("a recording never contains the API key", async (t) => {
  const dir = tempDir(t);
  const live = fakeLive(validAnswer({ tagline: `echo ${KEY}` }));
  await createRecordingClient(URL_A, { dir, live, apiKey: KEY }).complete([]);

  const raw = readFileSync(recordingPath(URL_A, dir), "utf8");
  assert.ok(!raw.includes(KEY), "key must be redacted");
  assert.ok(raw.includes("[REDACTED]"));
});

test("a failed live call writes no recording", async (t) => {
  const dir = tempDir(t);
  const error = new AiExtractionError(AI_ERROR.LLM_TIMEOUT, "timed out", { retryable: true });
  const client = createRecordingClient(URL_A, { dir, live: fakeLive(error), apiKey: KEY });

  await rejectsWithCode(client.complete([]), AI_ERROR.LLM_TIMEOUT);
  assert.equal(readdirSync(dir).length, 0);
});

test("an invalid answer is returned but never saved", async (t) => {
  const dir = tempDir(t);
  const client = createRecordingClient(URL_A, { dir, live: fakeLive('{"not":"a product"}'), apiKey: KEY });

  assert.equal(await client.complete([]), '{"not":"a product"}');
  assert.equal(readdirSync(dir).length, 0);
});

test("an invalid answer never overwrites a good recording", async (t) => {
  const dir = tempDir(t);
  const good = validAnswer({ name: "Acme CRM" });
  await createRecordingClient(URL_A, { dir, live: fakeLive(good), apiKey: KEY }).complete([]);
  await createRecordingClient(URL_A, { dir, live: fakeLive("not json"), apiKey: KEY }).complete([]);

  const saved = JSON.parse(readFileSync(recordingPath(URL_A, dir), "utf8"));
  assert.equal(saved.content, good);
});

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

test("replay returns the saved answer and labels the model as recorded", async (t) => {
  const dir = tempDir(t);
  const answer = validAnswer({ name: "A" });
  await createRecordingClient(URL_A, { dir, live: fakeLive(answer), apiKey: KEY }).complete([]);

  const replay = createReplayClient(URL_A, { dir });
  assert.equal(replay.model, "recorded:openai/gpt-oss-120b");
  assert.equal(await replay.complete([]), answer);
});

test("replay with no recording fails with NO_RECORDING and a clear message", async (t) => {
  const dir = tempDir(t);
  const replay = createReplayClient("https://other.example/x", { dir });
  await assert.rejects(replay.complete([]), (error) => {
    assert.equal(error.code, AI_ERROR.NO_RECORDING);
    assert.equal(error.retryable, false);
    assert.match(error.message, /no recorded response for this URL/);
    return true;
  });
});

test("an unreadable recording fails with NO_RECORDING, not a crash", (t) => {
  const dir = tempDir(t);
  writeFileSync(recordingPath(URL_A, dir), "{not json");
  assert.throws(() => createReplayClient(URL_A, { dir }), (error) => error.code === AI_ERROR.NO_RECORDING);
});

// ---------------------------------------------------------------------------
// Choosing the client (LLM_MODE)
// ---------------------------------------------------------------------------

test("LLM_MODE picks live, record or replay", async (t) => {
  const dir = tempDir(t);
  const liveAnswer = validAnswer({ name: "Live" });
  const live = fakeLive(liveAnswer);
  const createLive = () => live;
  const pick = (mode, apiKey) => createLlmClient(URL_A, { mode, apiKey, dir, createLive });

  // auto: key -> live (and nothing recorded); no key -> replay
  assert.equal(pick("auto", KEY), live);
  await pick("auto", KEY).complete([]);
  assert.equal(existsSync(recordingPath(URL_A, dir)), false);
  await rejectsWithCode(pick("auto", "").complete([]), AI_ERROR.NO_RECORDING);

  // live: always the live client
  assert.equal(pick("live", ""), live);

  // record: live answer, saved to disk
  assert.equal(await pick("record", KEY).complete([]), liveAnswer);
  assert.equal(existsSync(recordingPath(URL_A, dir)), true);

  // replay: never calls live, even with a key
  const callsBefore = live.calls.length;
  assert.equal(await pick("replay", KEY).complete([]), liveAnswer);
  assert.equal(live.calls.length, callsBefore);
});

// ---------------------------------------------------------------------------
// End to end: replayed answers still go through validation and verification
// ---------------------------------------------------------------------------

const html = `<!doctype html><html><head><title>Acme CRM</title>
<meta name="description" content="Acme CRM helps small teams manage deals."></head>
<body><main><h1>Acme CRM</h1><p>Acme CRM helps small teams manage deals.</p></main></body></html>`;
const input = buildProductExtractionInput(html, URL_A);

function modelAnswer(overrides) {
  const base = Object.fromEntries(
    AI_PRODUCT_EXTRACTION_FIELDS.map((f) => [f, LIST_FIELDS.includes(f) ? [] : null]),
  );
  return JSON.stringify({ ...base, sources: [], ...overrides });
}

test("a replayed answer gives the same product as the live answer", async (t) => {
  const dir = tempDir(t);
  const answer = modelAnswer({
    name: "Acme CRM",
    short_description: "Acme CRM helps small teams manage deals.",
  });
  const live = await extractProduct(input, null, {
    client: createRecordingClient(URL_A, { dir, live: fakeLive(answer), apiKey: KEY }),
  });
  const replayed = await extractProduct(input, null, { client: createReplayClient(URL_A, { dir }) });

  assert.deepEqual(replayed.data.product, live.data.product);
  assert.deepEqual(replayed.data.sources, live.data.sources);
  assert.equal(replayed.data.extraction.model, "recorded:openai/gpt-oss-120b");
});

test("replay cannot add invented data: values not on the live page are still dropped", async (t) => {
  const dir = tempDir(t);
  // A recording made when the page said something it no longer says.
  const stale = modelAnswer({
    name: "Acme CRM",
    tagline: "Now with AI forecasting",
  });
  writeFileSync(
    recordingPath(URL_A, dir),
    JSON.stringify({ url: URL_A, model: "m", recorded_at: "x", content: stale }),
  );

  const result = await extractProduct(input, null, { client: createReplayClient(URL_A, { dir }) });

  assert.equal(result.data.product.name, "Acme CRM");
  assert.equal(result.data.product.tagline, null);
  assert.ok(
    result.data.review.discarded.some((d) => d.field === "tagline" && d.reason === "not_found_on_page"),
  );
});
