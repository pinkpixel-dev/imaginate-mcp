import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OpenAIConfig } from "../../config.js";
import { buildBaseName, loadImage, loadImages, resolveOutputDir, saveImage, type SavedImage } from "../../lib/files.js";
import { guard } from "../../lib/errors.js";
import { imageResult, noImageResult, textResult } from "../../lib/result.js";
import { formatModelCatalog, OPENAI_IMAGE_MODELS } from "../../lib/models.js";
import { OpenAIImageClient, type OpenAIImage } from "./client.js";

const sharedShape = {
  output_dir: z
    .string()
    .optional()
    .describe("Absolute directory to save into. Defaults to the server's configured output directory."),
  filename: z
    .string()
    .optional()
    .describe("Base filename without extension. Defaults to a slug of the prompt plus a timestamp. Never overwrites an existing file."),
  n: z.number().int().min(1).max(10).default(1).describe("How many images to generate (1-10)."),
  size: z
    .string()
    .optional()
    .describe(
      "Output size such as '1024x1024', '1536x1024' (landscape), '1024x1536' (portrait), or 'auto'. gpt-image-2 also accepts custom sizes up to 3840px per edge (both edges multiples of 16, ratio at most 3:1).",
    ),
  quality: z
    .enum(["low", "medium", "high", "auto"])
    .optional()
    .describe("Rendering quality. Use 'low' for fast drafts and 'high' for final assets. Defaults to 'auto'."),
  background: z
    .enum(["opaque", "transparent", "auto"])
    .optional()
    .describe("Background handling. 'transparent' is not supported by gpt-image-2."),
  output_format: z.enum(["png", "jpeg", "webp"]).optional().describe("Saved file format. Defaults to png. jpeg is fastest."),
  output_compression: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Compression level 0-100. Only applies to jpeg and webp."),
};

const GenerateSchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .max(32000)
      .describe("What to draw. Be specific about subject, style, materials, lighting, and camera angle."),
    model: z.string().optional().describe("Image model ID. Defaults to the server's configured OpenAI model."),
    moderation: z
      .enum(["auto", "low"])
      .optional()
      .describe("Content filter strictness. 'low' is less restrictive but still enforces OpenAI policy."),
    ...sharedShape,
  })
  .strict();

const EditSchema = z
  .object({
    prompt: z.string().min(1).max(32000).describe("What to change, or how to combine the reference images."),
    images: z
      .array(z.string().min(1))
      .min(1)
      .max(16)
      .describe(
        "Absolute paths to source images on this machine. Pass one path to edit a single image, or several to compose a new image from multiple references. Remote URLs are not supported.",
      ),
    mask: z
      .string()
      .optional()
      .describe(
        "Optional absolute path to a mask PNG for inpainting. Transparent areas are the parts that get repainted. Must match the first source image's size and have an alpha channel.",
      ),
    model: z.string().optional().describe("Image model ID. Defaults to the server's configured OpenAI model."),
    input_fidelity: z
      .enum(["high", "low"])
      .optional()
      .describe("How closely to preserve details from the source images. Not accepted by gpt-image-2, which always uses high fidelity."),
    ...sharedShape,
  })
  .strict();

const ListSchema = z.object({}).strict();

/** Registers the OpenAI image tools. Only called when an OpenAI API key is configured. */
export function registerOpenAITools(server: McpServer, config: OpenAIConfig, defaultOutputDir: string): void {
  const client = new OpenAIImageClient(config);

  server.registerTool(
    "openai_generate_image",
    {
      title: "Generate an image with OpenAI GPT Image",
      description: `Generate one or more images from a text prompt using OpenAI's GPT Image models, and save them to disk.

Use this for text-to-image work: illustrations, product shots, concept art, icons, and diagrams. GPT Image handles in-image text better than most models and follows detailed layout instructions well.

Args:
  - prompt (string, required): What to draw. Describe subject, style, lighting, and framing rather than naming a single object.
  - model (string): Model ID. Defaults to '${config.defaultModel}'. Call openai_list_image_models to see the options.
  - n (number): How many images, 1-10. Default 1.
  - size (string): '1024x1024', '1536x1024', '1024x1536', 'auto', or a custom size on gpt-image-2.
  - quality ('low' | 'medium' | 'high' | 'auto'): Cost and latency scale with this. Default 'auto'.
  - background ('opaque' | 'transparent' | 'auto'): 'transparent' needs gpt-image-1.5 or older.
  - output_format ('png' | 'jpeg' | 'webp'), output_compression (0-100 for jpeg/webp).
  - moderation ('auto' | 'low'): Filter strictness.
  - output_dir (string), filename (string): Where and under what name to save.

Returns:
  Text listing the absolute path of every saved file, the model used, the settings applied, and any prompt rewrite the model performed.

Examples:
  - Use when: "Make me a watercolor poster of a lighthouse at dusk"
  - Use when: "Generate 3 square app icon concepts for a note-taking app"
  - Don't use when: You want to change an image that already exists (use openai_edit_image)

Error Handling:
  - Content moderation blocks return guidance to rewrite the prompt. Do not retry the same prompt.
  - HTTP 429 means rate limited or out of quota. Wait, then retry or lower quality.
  - A verification error means the account has not completed OpenAI organization verification for GPT Image models.
  - Complex prompts can take up to two minutes.`,
      inputSchema: GenerateSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) =>
      guard("OpenAI", async () => {
        const model = params.model ?? config.defaultModel;
        const images = await client.generate({
          prompt: params.prompt,
          model,
          n: params.n,
          ...pickShared(params),
          ...(params.moderation ? { moderation: params.moderation } : {}),
        });

        if (images.length === 0) return noImageResult("OpenAI", undefined);

        const saved = await persist(images, params, defaultOutputDir, "openai");
        return imageResult(saved, {
          model,
          prompt: params.prompt,
          ...(images[0]?.revisedPrompt ? { revisedPrompt: images[0].revisedPrompt } : {}),
          settings: { size: params.size, quality: params.quality, background: params.background, n: params.n },
        });
      }),
  );

  server.registerTool(
    "openai_edit_image",
    {
      title: "Edit or compose images with OpenAI GPT Image",
      description: `Edit an existing image, or build a new image out of several reference images, using OpenAI's GPT Image models. Saves the result to disk.

This one tool covers three jobs:
  1. Image-to-image editing: pass one path and describe the change.
  2. Inpainting: pass one path plus a mask PNG, and only the transparent areas of the mask get repainted.
  3. Multi-image composition: pass several paths and describe how to combine them into one new scene.

Args:
  - prompt (string, required): What to change, or how to combine the references.
  - images (string[], required): 1-16 absolute paths to local image files. Remote URLs are not supported, so download first.
  - mask (string): Absolute path to a mask PNG with an alpha channel, matching the first source image's size. Applies to the first image only.
  - model (string): Defaults to '${config.defaultModel}'.
  - input_fidelity ('high' | 'low'): Detail preservation. gpt-image-2 ignores this and always uses high.
  - n, size, quality, background, output_format, output_compression, output_dir, filename: same as openai_generate_image.

Returns:
  Text listing the absolute path of every saved file, the model used, and the settings applied. Source files are never modified.

Examples:
  - Use when: "Put a red scarf on the cat in ~/pics/cat.png"
  - Use when: "Combine the sofa from sofa.png and the rug from rug.png into one living room photo"
  - Use when: "Replace just the sky in landscape.png" with a mask covering the sky
  - Don't use when: There is no source image yet (use openai_generate_image)

Error Handling:
  - A file read error means the path is wrong. Pass an absolute path to an existing file.
  - Masking is prompt-guided rather than pixel-precise, so describe the intended change in the prompt as well.
  - Moderation, rate limit, and verification errors behave the same as openai_generate_image.`,
      inputSchema: EditSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) =>
      guard("OpenAI", async () => {
        const model = params.model ?? config.defaultModel;
        const sources = await loadImages(params.images);
        const mask = params.mask ? await loadImage(params.mask) : undefined;

        const images = await client.edit({
          prompt: params.prompt,
          model,
          n: params.n,
          images: sources,
          ...(mask ? { mask } : {}),
          ...(params.input_fidelity ? { inputFidelity: params.input_fidelity } : {}),
          ...pickShared(params),
        });

        if (images.length === 0) return noImageResult("OpenAI", undefined);

        const saved = await persist(images, params, defaultOutputDir, "openai-edit");
        return imageResult(saved, {
          model,
          prompt: params.prompt,
          settings: {
            sources: sources.length,
            mask: mask ? mask.fileName : undefined,
            size: params.size,
            quality: params.quality,
            n: params.n,
          },
        });
      }),
  );

  server.registerTool(
    "openai_list_image_models",
    {
      title: "List OpenAI image models",
      description: `List the OpenAI GPT Image models this server can use, with what each one is good for and its constraints.

Call this before picking a non-default model, or after a 404 on a model ID.

Args: none.

Returns: Markdown describing each model ID, its strengths, and its limits, plus the server's configured default.`,
      inputSchema: ListSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () =>
      textResult(
        formatModelCatalog("OpenAI image models", OPENAI_IMAGE_MODELS, config.defaultModel, [
          "All GPT Image models require OpenAI API organization verification before use.",
          "Cost scales with quality and size, so use 'low' quality while iterating.",
        ]),
      ),
  );
}

type SharedParams = z.infer<typeof GenerateSchema> | z.infer<typeof EditSchema>;

/** Maps the shared snake_case tool params onto the client's option names. */
function pickShared(params: SharedParams) {
  return {
    ...(params.size ? { size: params.size } : {}),
    ...(params.quality ? { quality: params.quality } : {}),
    ...(params.background ? { background: params.background } : {}),
    ...(params.output_format ? { outputFormat: params.output_format } : {}),
    ...(params.output_compression !== undefined ? { outputCompression: params.output_compression } : {}),
  };
}

async function persist(
  images: OpenAIImage[],
  params: SharedParams,
  defaultOutputDir: string,
  prefix: string,
): Promise<SavedImage[]> {
  const outputDir = await resolveOutputDir(params.output_dir, defaultOutputDir);

  const saved: SavedImage[] = [];
  for (const [index, image] of images.entries()) {
    saved.push(
      await saveImage({
        data: image.data,
        outputDir,
        mimeType: image.mimeType,
        baseName: buildBaseName({
          requestedName: params.filename,
          prompt: params.prompt,
          prefix,
          index,
          total: images.length,
        }),
      }),
    );
  }
  return saved;
}
