import dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT || 5001;
export const NODE_ENV = process.env.NODE_ENV || "development";
export const DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

// Groq LLM (AI product extraction). The key is read here and never logged.
export const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

// How the AI step gets its answer (see services/ai/recorded.client.js):
//   auto   - key set: live Groq; no key: replay recorded answers (default)
//   live   - always Groq
//   record - Groq, and save each answer to server/recordings/
//   replay - always recorded answers, never Groq
export const LLM_MODES = ["auto", "live", "record", "replay"];
const requestedMode = (process.env.LLM_MODE || "auto").trim().toLowerCase();
export const LLM_MODE = LLM_MODES.includes(requestedMode) ? requestedMode : "auto";

// Where recordings live. Overridable so tests and trials don't touch the repo copy.
export const LLM_RECORDINGS_DIR = process.env.LLM_RECORDINGS_DIR || "";
