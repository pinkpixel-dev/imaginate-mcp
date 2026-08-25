import os from "node:os";
import path from "node:path";

/** Default models used when a tool call does not name one. */
export const DEFAULT_OPENAI_MODEL = "gpt-image-2";
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-image";

/** Where images land when neither the env nor the tool call specifies a directory. */
const FALLBACK_OUTPUT_DIR = path.join(os.homedir(), "Pictures", "imaginate");

export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel: string;
}

export interface GoogleConfig {
  apiKey: string;
  defaultModel: string;
}

export interface ServerConfig {
  outputDir: string;
  openai?: OpenAIConfig;
  google?: GoogleConfig;
}

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Reads configuration from the environment.
 *
 * A provider is only configured when its API key is present, which is what lets
 * the server register just the tools the user can actually call.
 */
export function loadConfig(): ServerConfig {
  const outputDirRaw = readEnv("IMAGINATE_OUTPUT_DIR") ?? FALLBACK_OUTPUT_DIR;
  const outputDir = path.resolve(expandHome(outputDirRaw));

  const openaiKey = readEnv("OPENAI_API_KEY");
  const googleKey = readEnv("GEMINI_API_KEY", "GOOGLE_API_KEY");

  const config: ServerConfig = { outputDir };

  if (openaiKey) {
    const baseURL = readEnv("OPENAI_BASE_URL");
    config.openai = {
      apiKey: openaiKey,
      defaultModel: readEnv("IMAGINATE_OPENAI_MODEL") ?? DEFAULT_OPENAI_MODEL,
      ...(baseURL ? { baseURL } : {}),
    };
  }

  if (googleKey) {
    config.google = {
      apiKey: googleKey,
      defaultModel: readEnv("IMAGINATE_GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL,
    };
  }

  return config;
}

/** Expands a leading `~` so `IMAGINATE_OUTPUT_DIR=~/Pictures` behaves as expected. */
export function expandHome(target: string): string {
  if (target === "~") return os.homedir();
  if (target.startsWith("~/")) return path.join(os.homedir(), target.slice(2));
  return target;
}
