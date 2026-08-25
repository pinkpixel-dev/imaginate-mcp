import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface ApiErrorShape {
  status?: number;
  code?: string;
  message?: string;
  error?: { code?: string; message?: string; status?: string };
}

/**
 * Turns any thrown value into an MCP error result whose text tells the calling
 * model what to do next, rather than just what went wrong.
 */
export function toToolError(provider: "OpenAI" | "Gemini", error: unknown): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: `${provider} image request failed. ${explain(provider, error)}` }],
  };
}

function explain(provider: string, error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const api = error as Error & ApiErrorShape;
  const status = api.status;
  const code = api.code ?? api.error?.code;
  const message = api.error?.message ?? api.message;

  if (code === "moderation_blocked") {
    return `The prompt or an input image was blocked by content moderation. Rewrite the prompt to remove the flagged subject matter and try again. Details: ${message}`;
  }

  if (status === 401 || status === 403) {
    return `Authentication was rejected (HTTP ${status}). Check the API key in the server environment. Do not retry with the same key. Details: ${message}`;
  }

  if (status === 429) {
    return `Rate limited or out of quota (HTTP 429). Wait a few seconds and retry, or lower the requested quality or image count. Details: ${message}`;
  }

  if (status === 400 && /verif/i.test(message ?? "")) {
    return `The ${provider} organization is not verified for this image model. Complete organization verification in the provider console, or switch to a model the account already has access to. Details: ${message}`;
  }

  if (status === 404) {
    return `The requested model was not found (HTTP 404). Call the matching list-models tool to see which model IDs this server supports. Details: ${message}`;
  }

  if (status && status >= 500) {
    return `The provider returned a server error (HTTP ${status}). This is usually temporary, so retry once before changing the request. Details: ${message}`;
  }

  return message ?? error.message;
}

/** Wraps a tool handler so no thrown error ever escapes as a transport-level failure. */
export function guard(
  provider: "OpenAI" | "Gemini",
  handler: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  return handler().catch((error: unknown) => toToolError(provider, error));
}
