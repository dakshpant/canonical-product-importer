// Record and replay LLM answers, so the app can run without an API key.
//
//   record: call Groq as normal, then save its answer for that URL
//   replay: read the saved answer instead of calling Groq
//
// Only the model's PROPOSAL is replayed. The page is still scraped live, and
// verifyExtraction still checks every value against that live page, so a
// replayed answer cannot put anything on a record that the page doesn't show.
//
// Every client here has the same shape as the Groq client:
//   { model, complete(messages) -> string }
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GROQ_API_KEY, LLM_MODE, LLM_RECORDINGS_DIR } from "../../config/env.js";
import { validateProductExtraction } from "../../validators/product-extraction.validator.js";
import { AI_ERROR, AiExtractionError, redact } from "./errors.js";
import { createGroqClient } from "./groq.client.js";

// server/recordings/ (resolved from this file, so the working directory doesn't matter)
export const DEFAULT_RECORDINGS_DIR =
  LLM_RECORDINGS_DIR || fileURLToPath(new URL("../../../recordings/", import.meta.url));

/** One file per URL: readable host/path plus a short hash so names are unique. */
export function recordingPath(url, dir = DEFAULT_RECORDINGS_DIR) {
  let readable = "page";
  try {
    const { hostname, pathname } = new URL(url);
    readable = `${hostname}${pathname}`;
  } catch {
    // Not a URL: the hash alone still makes the name unique.
  }
  readable = readable.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "page";
  const hash = createHash("sha256").update(String(url)).digest("hex").slice(0, 8);
  return path.join(dir, `${readable}_${hash}.json`);
}

function readRecording(file) {
  try {
    const recording = JSON.parse(readFileSync(file, "utf8"));
    if (typeof recording?.content !== "string") throw new Error("missing content");
    return recording;
  } catch (error) {
    throw new AiExtractionError(
      AI_ERROR.NO_RECORDING,
      `The recorded response for this URL is unreadable (${path.basename(file)}): ${error.message}.`,
    );
  }
}

/** Replays the saved answer for `url`. Never makes a network call. */
export function createReplayClient(url, { dir = DEFAULT_RECORDINGS_DIR } = {}) {
  const file = recordingPath(url, dir);
  const recording = existsSync(file) ? readRecording(file) : null;

  return {
    model: recording ? `recorded:${recording.model ?? "unknown"}` : "recorded",
    async complete() {
      if (!recording) {
        throw new AiExtractionError(
          AI_ERROR.NO_RECORDING,
          "No GROQ_API_KEY is set and there is no recorded response for this URL. " +
            "Add a key to server/.env, or import one of the recorded URLs listed in the README.",
        );
      }
      return recording.content;
    },
  };
}

// Only an answer that passes the same validation as a live answer is worth
// keeping: an invalid one would make every replay of that URL fail.
function isValidAnswer(content) {
  try {
    const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return validateProductExtraction(JSON.parse(text)).success;
  } catch {
    return false;
  }
}

/**
 * Calls the live client, then saves its answer for `url`, but only if the
 * answer is valid, so a bad answer never overwrites a good recording.
 */
export function createRecordingClient(
  url,
  { dir = DEFAULT_RECORDINGS_DIR, live = createGroqClient(), apiKey = GROQ_API_KEY } = {},
) {
  const file = recordingPath(url, dir);

  return {
    model: live.model,
    async complete(messages) {
      // A failed call throws here, so nothing is written for it.
      const content = await live.complete(messages);
      // An invalid answer is returned (the pipeline retries or reports it)
      // but never saved.
      if (!isValidAnswer(content)) return content;
      mkdirSync(path.dirname(file), { recursive: true });
      // Only the model's answer is stored: never request headers or the key.
      const recording = {
        url,
        model: live.model,
        recorded_at: new Date().toISOString(),
        content: redact(content, apiKey),
      };
      writeFileSync(file, `${JSON.stringify(recording, null, 2)}\n`);
      return content;
    },
  };
}

/**
 * The client for one URL, chosen by LLM_MODE:
 *   auto   -> live Groq if a key is set, otherwise replay
 *   live   -> live Groq (throws LLM_NOT_CONFIGURED without a key)
 *   record -> live Groq, saving each answer
 *   replay -> replay only
 */
export function createLlmClient(
  url,
  { mode = LLM_MODE, apiKey = GROQ_API_KEY, dir = DEFAULT_RECORDINGS_DIR, createLive = createGroqClient } = {},
) {
  switch (mode) {
    case "replay":
      return createReplayClient(url, { dir });
    case "record":
      return createRecordingClient(url, { dir, live: createLive({ apiKey }), apiKey });
    case "live":
      return createLive({ apiKey });
    default:
      return apiKey ? createLive({ apiKey }) : createReplayClient(url, { dir });
  }
}
