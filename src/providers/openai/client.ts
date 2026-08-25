import OpenAI, { toFile } from "openai";
import type { Uploadable } from "openai/uploads";
import type { OpenAIConfig } from "../../config.js";
import type { LoadedImage } from "../../lib/files.js";

export interface OpenAIImage {
  data: Buffer;
  mimeType: string;
  revisedPrompt?: string;
}

export interface GenerateOptions {
  prompt: string;
  model: string;
  n: number;
  size?: string;
  quality?: string;
  background?: "opaque" | "transparent" | "auto";
  outputFormat?: "png" | "jpeg" | "webp";
  outputCompression?: number;
  moderation?: "auto" | "low";
}

export interface EditOptions extends GenerateOptions {
  images: LoadedImage[];
  mask?: LoadedImage;
  inputFidelity?: "high" | "low";
}

/** Thin wrapper around the OpenAI Image API that returns decoded image buffers. */
export class OpenAIImageClient {
  private readonly client: OpenAI;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
  }

  async generate(options: GenerateOptions): Promise<OpenAIImage[]> {
    const response = await this.client.images.generate({
      model: options.model,
      prompt: options.prompt,
      n: options.n,
      ...(options.size ? { size: options.size } : {}),
      ...(options.quality ? { quality: options.quality as "low" | "medium" | "high" | "auto" } : {}),
      ...(options.background ? { background: options.background } : {}),
      ...(options.outputFormat ? { output_format: options.outputFormat } : {}),
      ...(options.outputCompression !== undefined ? { output_compression: options.outputCompression } : {}),
      ...(options.moderation ? { moderation: options.moderation } : {}),
    });

    return decode(response, options.outputFormat);
  }

  async edit(options: EditOptions): Promise<OpenAIImage[]> {
    const images = await Promise.all(options.images.map(toUploadable));
    const mask = options.mask ? await toUploadable(options.mask) : undefined;

    const response = await this.client.images.edit({
      model: options.model,
      prompt: options.prompt,
      image: images,
      n: options.n,
      ...(mask ? { mask } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.quality ? { quality: options.quality as "low" | "medium" | "high" | "auto" } : {}),
      ...(options.background ? { background: options.background } : {}),
      ...(options.outputFormat ? { output_format: options.outputFormat } : {}),
      ...(options.outputCompression !== undefined ? { output_compression: options.outputCompression } : {}),
      ...(options.inputFidelity ? { input_fidelity: options.inputFidelity } : {}),
    });

    return decode(response, options.outputFormat);
  }
}

function toUploadable(image: LoadedImage): Promise<Uploadable> {
  return toFile(image.bytes, image.fileName, { type: image.mimeType });
}

/** Pulls base64 payloads out of an image response and decodes them to buffers. */
function decode(
  response: { data?: Array<{ b64_json?: string; revised_prompt?: string }> | null },
  outputFormat: string | undefined,
): OpenAIImage[] {
  const mimeType = outputFormat === "jpeg" ? "image/jpeg" : outputFormat === "webp" ? "image/webp" : "image/png";

  return (response.data ?? [])
    .filter((item): item is { b64_json: string; revised_prompt?: string } => Boolean(item.b64_json))
    .map((item) => ({
      data: Buffer.from(item.b64_json, "base64"),
      mimeType,
      ...(item.revised_prompt ? { revisedPrompt: item.revised_prompt } : {}),
    }));
}
