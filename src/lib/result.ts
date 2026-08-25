import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SavedImage } from "./files.js";

export interface ImageResultDetails {
  model: string;
  prompt: string;
  /** Provider-reported prompt rewrite, when the provider performs one. */
  revisedPrompt?: string;
  /** Any text the model returned alongside the image. */
  note?: string;
  /** Extra request facts worth echoing back, such as size or aspect ratio. */
  settings?: Record<string, string | number | undefined>;
  /** Interaction id callers can pass back in to continue an edit thread. */
  interactionId?: string;
}

/** Plain text tool result, used for listings and simple messages. */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

/**
 * Formats a successful image run.
 *
 * File paths come first because that is the only part the caller needs in order
 * to keep working with the image.
 */
export function imageResult(saved: SavedImage[], details: ImageResultDetails): CallToolResult {
  const lines: string[] = [];

  lines.push(saved.length === 1 ? "Saved 1 image:" : `Saved ${saved.length} images:`);
  for (const file of saved) {
    lines.push(`- ${file.filePath} (${formatBytes(file.bytes)}, ${file.mimeType})`);
  }

  lines.push("", `Model: ${details.model}`);

  const settings = Object.entries(details.settings ?? {}).filter(([, value]) => value !== undefined);
  if (settings.length > 0) {
    lines.push(`Settings: ${settings.map(([key, value]) => `${key}=${value}`).join(", ")}`);
  }

  if (details.interactionId) {
    lines.push(`Interaction id: ${details.interactionId} (pass as previous_interaction_id to keep editing)`);
  }

  if (details.revisedPrompt && details.revisedPrompt !== details.prompt) {
    lines.push("", `Revised prompt used by the model: ${details.revisedPrompt}`);
  }

  if (details.note) {
    lines.push("", `Model note: ${details.note}`);
  }

  return textResult(lines.join("\n"));
}

/** Error result for the case where a provider returns no image at all. */
export function noImageResult(provider: string, note: string | undefined): CallToolResult {
  const suffix = note ? ` The model replied with text instead: "${note}"` : "";
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `${provider} returned no image for this request.${suffix} ` +
          `Rephrase the prompt as a direct instruction to produce an image and try again.`,
      },
    ],
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
