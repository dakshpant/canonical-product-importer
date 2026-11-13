import dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT || 5001;
export const NODE_ENV = process.env.NODE_ENV || "development";
export const DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

// Groq LLM (AI product extraction). The key is read here and never logged.
export const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
