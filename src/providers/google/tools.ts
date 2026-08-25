import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleConfig } from "../../config.js";
import { buildBaseName, loadImages, resolveOutputDir, saveImage, type SavedImage } from "../../lib/files.js";
import { guard } from "../../lib/errors.js";
import { imageResult, noImageResult, textResult } from "../../lib/result.js";
import { formatModelCatalog, GEMINI_IMAGE_MODELS } from "../../lib/models.js";
import { GeminiImageClient, type GeminiResult } from "./client.js";

const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;

const sharedShape = {
  model: z.string().optional().describe("Model ID. Defaults to the server's configured Gemini image model."),
  aspect_ratio: z
    .enum(ASPECT_RATIOS)
    .optional()
    .describe("Aspect ratio of the output. Without it the model matches an input image, or falls back to 1:1."),
  image_size: z
    .enum(["512", "1K", "2K", "4K"])
    .optional()
    .describe("Resolution tier. Nano Banana 2 Lite supports 1K only. The uppercase K matters."),
  output_dir: z
    .string()
    .optional()
    .describe("Absolute directory to save into. Defaults to the server's configured output directory."),
  filename: z
    .string()
    .optional()
    .describe("Base filename without extension. Defaults to a slug of the prompt plus a timestamp. Never overwrites an existing file."),
};

const GenerateSchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .max(32000)
      .describe(
        "What to draw. Describe materials, lighting, and camera angle, and phrase exclusions positively ('empty street' rather than 'no cars').",
      ),
    thinking_level: z
      .enum(["minimal", "high"])
      .optional()
      .describe("Trades latency for quality on tricky prompts. Supported by gemini-3.1-flash-image. Default is 'minimal'."),
    google_search: z
      .boolean()
      .default(false)
      .describe("Let the model look up real-time facts before drawing, for things like weather charts or recent events."),
    image_search: z
      .boolean()
      .default(false)
      .describe("Also ground on Google Image Search for visual reference. Requires google_search and gemini-3.1-flash-image."),
    ...sharedShape,
  })
  .strict();

const EditSchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .max(32000)
      .describe(
        "What to change, or how to combine the references. For targeted edits, say what must stay the same: 'change only the sky, keep everything else exactly the same'.",
      ),
    images: z
      .array(z.string().min(1))
      .max(14)
      .default([])
      .describe(
        "Absolute paths to local reference images. Limits vary by model: up to 14 on Lite, 10 on Nano Banana 2, 6 on Pro. Leave empty only when chaining from previous_interaction_id.",
      ),
    previous_interaction_id: z
      .string()
      .optional()
      .describe(
        "Interaction id from an earlier call, to keep editing that image without resending it. Cheaper and more consistent than re-uploading.",
      ),
    thinking_level: z
      .enum(["minimal", "high"])
      .optional()
      .describe("Trades latency for quality on tricky edits. Supported by gemini-3.1-flash-image."),
    ...sharedShape,
  })
  .strict();

const ListSchema = z.object({}).strict();

/** Registers the Gemini image tools. Only called when a Gemini API key is configured. */
export function registerGoogleTools(server: McpServer, config: GoogleConfig, defaultOutputDir: string): void {
  const client = new GeminiImageClient(config);

  server.registerTool(
    "gemini_generate_image",
    {
      title: "Generate an image with Gemini (Nano Banana)",
      description: `Generate an image from a text prompt using Google's Gemini image models (Nano Banana), and save it to disk.

Gemini is strong at text rendering inside images, world knowledge, and infographic-style work, and it can ground on live Google Search results before drawing.

Args:
  - prompt (string, required): What to draw. Be specific about materials, lighting, and camera angle. Phrase exclusions positively.
  - model (string): Defaults to '${config.defaultModel}'. Call gemini_list_image_models for the options.
  - aspect_ratio ('1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:3' | '3:2' | '4:5' | '5:4' | '21:9'): Defaults to 1:1.
  - image_size ('512' | '1K' | '2K' | '4K'): Resolution tier. Lite supports 1K only.
  - thinking_level ('minimal' | 'high'): Higher is slower but better on hard prompts.
  - google_search (boolean): Ground on live search results for facts like weather or recent events.
  - image_search (boolean): Also ground on Google Image Search. Needs google_search and gemini-3.1-flash-image.
  - output_dir (string), filename (string): Where and under what name to save.

Returns:
  Text listing the absolute path of every saved file, the model used, the settings applied, and an interaction id you can pass to gemini_edit_image as previous_interaction_id to keep refining the same image.

Examples:
  - Use when: "Draw a hand-lettered coffee shop menu board with real readable text"
  - Use when: "Visualize this week's San Francisco forecast as a clean chart" with google_search enabled
  - Don't use when: You already have an image to change (use gemini_edit_image)

Error Handling:
  - HTTP 429 means rate limited or out of quota. Wait and retry.
  - A 404 on the model ID means it is unavailable to this key. Call gemini_list_image_models.
  - The model does not reliably honor a requested image count, so ask for one image per call.
  - All output carries an invisible SynthID watermark.`,
      inputSchema: GenerateSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) =>
      guard("Gemini", async () => {
        const model = params.model ?? config.defaultModel;
        const result = await client.create({
          prompt: params.prompt,
          model,
          ...(params.aspect_ratio ? { aspectRatio: params.aspect_ratio } : {}),
          ...(params.image_size ? { imageSize: params.image_size } : {}),
          ...(params.thinking_level ? { thinkingLevel: params.thinking_level } : {}),
          ...(params.google_search ? { googleSearch: true, imageSearch: params.image_search } : {}),
        });

        return present(result, {
          model,
          prompt: params.prompt,
          prefix: "gemini",
          outputDir: params.output_dir,
          filename: params.filename,
          defaultOutputDir,
          settings: { aspect_ratio: params.aspect_ratio, image_size: params.image_size, grounded: params.google_search ? "yes" : undefined },
        });
      }),
  );

  server.registerTool(
    "gemini_edit_image",
    {
      title: "Edit or compose images with Gemini (Nano Banana)",
      description: `Edit an existing image, or compose a new one from several reference images, using Google's Gemini image models. Saves the result to disk.

This one tool covers several jobs:
  1. Image-to-image editing: pass one path and describe the change.
  2. Semantic inpainting: no mask file needed, just say "change only the X and keep everything else exactly the same".
  3. Style transfer: pass one path and describe the target style.
  4. Multi-image composition: pass several paths and describe how to combine them.
  5. Iterative refinement: pass previous_interaction_id instead of re-uploading the image.

Args:
  - prompt (string, required): What to change, or how to combine the references.
  - images (string[]): Absolute paths to local files. Up to 14 on Lite, 10 on Nano Banana 2, 6 on Pro. Remote URLs are not supported, so download first.
  - previous_interaction_id (string): Continue from an earlier call's interaction id instead of resending images.
  - model, aspect_ratio, image_size, thinking_level, output_dir, filename: same as gemini_generate_image.

Returns:
  Text listing the absolute path of every saved file plus a new interaction id for the next round of edits. Source files are never modified.

Examples:
  - Use when: "Add a knitted wizard hat to the cat in ~/pics/cat.png"
  - Use when: "Put the person from portrait.png into the scene from beach.png, matching the lighting"
  - Use when: "Now make that same image landscape" using previous_interaction_id from the last call
  - Don't use when: There is no source image and no interaction id (use gemini_generate_image)

Error Handling:
  - Either images or previous_interaction_id must be provided, otherwise the call is rejected before hitting the API.
  - A file read error means the path is wrong. Pass an absolute path to an existing file.
  - Rate limit and model errors behave the same as gemini_generate_image.`,
      inputSchema: EditSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) =>
      guard("Gemini", async () => {
        if (params.images.length === 0 && !params.previous_interaction_id) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text:
                  "Nothing to edit. Pass at least one path in 'images', or pass 'previous_interaction_id' " +
                  "from an earlier Gemini call to keep working on that image. To make a new image from scratch, " +
                  "use gemini_generate_image instead.",
              },
            ],
          };
        }

        const model = params.model ?? config.defaultModel;
        const sources = await loadImages(params.images);

        const result = await client.create({
          prompt: params.prompt,
          model,
          images: sources,
          ...(params.previous_interaction_id ? { previousInteractionId: params.previous_interaction_id } : {}),
          ...(params.aspect_ratio ? { aspectRatio: params.aspect_ratio } : {}),
          ...(params.image_size ? { imageSize: params.image_size } : {}),
          ...(params.thinking_level ? { thinkingLevel: params.thinking_level } : {}),
        });

        return present(result, {
          model,
          prompt: params.prompt,
          prefix: "gemini-edit",
          outputDir: params.output_dir,
          filename: params.filename,
          defaultOutputDir,
          settings: {
            sources: sources.length,
            chained: params.previous_interaction_id ? "yes" : undefined,
            aspect_ratio: params.aspect_ratio,
            image_size: params.image_size,
          },
        });
      }),
  );

  server.registerTool(
    "gemini_list_image_models",
    {
      title: "List Gemini image models",
      description: `List the Gemini image models (Nano Banana) this server can use, with what each one is good for, its reference image limits, and its resolution ceiling.

Call this before picking a non-default model, or after a 404 on a model ID.

Args: none.

Returns: Markdown describing each model ID, its strengths, and its limits, plus the server's configured default.`,
      inputSchema: ListSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () =>
      textResult(
        formatModelCatalog("Gemini image models (Nano Banana)", GEMINI_IMAGE_MODELS, config.defaultModel, [
          "Gemini 3 image models always run a thinking pass before finalizing, which cannot be disabled.",
          "Every generated image carries an invisible SynthID watermark.",
        ]),
      ),
  );
}

interface PresentOptions {
  model: string;
  prompt: string;
  prefix: string;
  outputDir: string | undefined;
  filename: string | undefined;
  defaultOutputDir: string;
  settings: Record<string, string | number | undefined>;
}

/** Saves whatever images came back and formats the tool result. */
async function present(result: GeminiResult, options: PresentOptions) {
  if (result.images.length === 0) return noImageResult("Gemini", result.text);

  const outputDir = await resolveOutputDir(options.outputDir, options.defaultOutputDir);

  const saved: SavedImage[] = [];
  for (const [index, image] of result.images.entries()) {
    saved.push(
      await saveImage({
        data: image.data,
        outputDir,
        mimeType: image.mimeType,
        baseName: buildBaseName({
          requestedName: options.filename,
          prompt: options.prompt,
          prefix: options.prefix,
          index,
          total: result.images.length,
        }),
      }),
    );
  }

  return imageResult(saved, {
    model: options.model,
    prompt: options.prompt,
    settings: options.settings,
    ...(result.interactionId ? { interactionId: result.interactionId } : {}),
    ...(result.text ? { note: result.text } : {}),
  });
}
