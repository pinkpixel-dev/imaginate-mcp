import { GoogleGenAI } from "@google/genai";
import type { GoogleConfig } from "../../config.js";
import type { LoadedImage } from "../../lib/files.js";

export interface GeminiImage {
  data: Buffer;
  mimeType: string;
}

export interface GeminiResult {
  images: GeminiImage[];
  /** Any text the model returned alongside the image. */
  text?: string;
  /** Id for chaining follow-up edits without resending the source images. */
  interactionId?: string;
}

export interface GeminiRequest {
  prompt: string;
  model: string;
  images?: LoadedImage[];
  aspectRatio?: string;
  imageSize?: string;
  thinkingLevel?: "minimal" | "high";
  googleSearch?: boolean;
  imageSearch?: boolean;
  previousInteractionId?: string;
}

type InputBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string };

/** Thin wrapper around the Gemini Interactions API for image generation and editing. */
export class GeminiImageClient {
  private readonly client: GoogleGenAI;

  constructor(config: GoogleConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async create(request: GeminiRequest): Promise<GeminiResult> {
    const input: InputBlock[] = [{ type: "text", text: request.prompt }];
    for (const image of request.images ?? []) {
      input.push({ type: "image", data: image.base64, mime_type: image.mimeType });
    }

    const responseFormat: Record<string, string> = { type: "image" };
    if (request.aspectRatio) responseFormat["aspect_ratio"] = request.aspectRatio;
    if (request.imageSize) responseFormat["image_size"] = request.imageSize;

    const interaction = await this.client.interactions.create({
      model: request.model,
      input: input as never,
      response_format: responseFormat as never,
      ...(request.previousInteractionId ? { previous_interaction_id: request.previousInteractionId } : {}),
      ...(request.thinkingLevel ? { generation_config: { thinking_level: request.thinkingLevel } as never } : {}),
      ...(request.googleSearch ? { tools: [buildSearchTool(request.imageSearch)] as never } : {}),
    });

    return {
      images: collectImages(interaction),
      ...(interaction.output_text ? { text: interaction.output_text } : {}),
      ...(interaction.id ? { interactionId: interaction.id } : {}),
    };
  }
}

function buildSearchTool(includeImageSearch: boolean | undefined): Record<string, unknown> {
  return includeImageSearch
    ? { type: "google_search", search_types: ["web_search", "image_search"] }
    : { type: "google_search" };
}

/**
 * Walks the interaction steps to collect every returned image.
 *
 * `output_image` only exposes the last image, which loses the extra frames in an
 * interleaved text-and-image response, so the steps are the reliable source.
 */
export function collectImages(interaction: { steps?: unknown; output_image?: { data?: string; mime_type?: string } }): GeminiImage[] {
  const images: GeminiImage[] = [];
  const seen = new Set<string>();

  for (const block of walkContentBlocks(interaction.steps)) {
    if (block.type !== "image" || typeof block.data !== "string" || block.data.length === 0) continue;
    if (seen.has(block.data)) continue;
    seen.add(block.data);
    images.push({ data: Buffer.from(block.data, "base64"), mimeType: block.mime_type ?? "image/png" });
  }

  if (images.length === 0 && interaction.output_image?.data) {
    images.push({
      data: Buffer.from(interaction.output_image.data, "base64"),
      mimeType: interaction.output_image.mime_type ?? "image/png",
    });
  }

  return images;
}

interface RawBlock {
  type?: string;
  data?: unknown;
  mime_type?: string;
}

/**
 * Yields the content blocks of the model's own output steps.
 *
 * Only `model_output` steps count. `user_input` steps echo back the source
 * images of an edit, and `thought` steps hold interim composition previews, so
 * including either would save images the caller never asked for.
 */
function* walkContentBlocks(steps: unknown): Generator<RawBlock & { type: string }> {
  if (!Array.isArray(steps)) return;

  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const record = step as { type?: string; content?: unknown };
    if (record.type !== "model_output") continue;

    for (const block of asArray(record.content)) {
      if (block && typeof block === "object" && typeof (block as RawBlock).type === "string") {
        yield block as RawBlock & { type: string };
      }
    }
  }
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}
