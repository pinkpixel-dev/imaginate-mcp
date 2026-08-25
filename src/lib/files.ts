import { promises as fs } from "node:fs";
import path from "node:path";
import { expandHome } from "../config.js";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/heic": "heic",
  "image/heif": "heif",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export interface LoadedImage {
  /** Raw bytes of the source file. */
  bytes: Buffer;
  /** Base64 encoding of `bytes`, which is what the Gemini API expects. */
  base64: string;
  mimeType: string;
  /** Absolute path the image was read from. */
  filePath: string;
  fileName: string;
}

export interface SavedImage {
  filePath: string;
  fileName: string;
  mimeType: string;
  bytes: number;
}

/** Maps a MIME type to a file extension, defaulting to png for anything unknown. */
export function extensionForMime(mimeType: string | undefined): string {
  if (!mimeType) return "png";
  return EXTENSION_BY_MIME[mimeType.toLowerCase()] ?? "png";
}

/** Maps a file extension to a MIME type, defaulting to png for anything unknown. */
export function mimeForPath(filePath: string): string {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? "image/png";
}

/**
 * Builds a filesystem-safe slug from a prompt so saved files are recognizable
 * at a glance instead of being a wall of timestamps.
 */
export function slugFromPrompt(prompt: string, maxLength = 40): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "image";
}

/** A short, sortable, collision-resistant timestamp such as `20260825-134512-071`. */
function timestamp(): string {
  const iso = new Date().toISOString();
  return `${iso.slice(0, 10).replace(/-/g, "")}-${iso.slice(11, 19).replace(/:/g, "")}-${iso.slice(20, 23)}`;
}

/** Resolves the directory an image should be written to and creates it. */
export async function resolveOutputDir(requested: string | undefined, fallback: string): Promise<string> {
  const dir = requested ? path.resolve(expandHome(requested)) : fallback;
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Writes image bytes to disk, never overwriting an existing file.
 *
 * When `baseName` is taken, a numeric suffix is appended until a free name is
 * found, so repeat generations with the same prompt all survive.
 */
export async function saveImage(options: {
  data: Buffer;
  outputDir: string;
  baseName: string;
  mimeType: string;
}): Promise<SavedImage> {
  const extension = extensionForMime(options.mimeType);
  const safeBase = options.baseName.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "image";

  let candidate = path.join(options.outputDir, `${safeBase}.${extension}`);
  let counter = 1;
  while (await pathExists(candidate)) {
    candidate = path.join(options.outputDir, `${safeBase}-${counter}.${extension}`);
    counter += 1;
  }

  await fs.writeFile(candidate, options.data);

  return {
    filePath: candidate,
    fileName: path.basename(candidate),
    mimeType: options.mimeType,
    bytes: options.data.byteLength,
  };
}

/** Builds the default base filename for a generated image. */
export function buildBaseName(options: {
  requestedName: string | undefined;
  prompt: string;
  prefix: string;
  index: number;
  total: number;
}): string {
  const stem = options.requestedName
    ? path.basename(options.requestedName).replace(/\.[^.]+$/, "")
    : `${options.prefix}-${slugFromPrompt(options.prompt)}-${timestamp()}`;
  return options.total > 1 ? `${stem}-${options.index + 1}` : stem;
}

/**
 * Reads a source image from disk for editing or composition.
 *
 * Throws a message aimed at the calling model, since a wrong path is by far the
 * most common failure and the fix is always "pass an absolute path".
 */
export async function loadImage(rawPath: string): Promise<LoadedImage> {
  const filePath = path.resolve(expandHome(rawPath));

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(filePath);
  } catch {
    throw new Error(
      `Could not read the image at '${rawPath}' (resolved to '${filePath}'). ` +
        `Pass an absolute path to a file that already exists on this machine. ` +
        `Remote URLs are not supported: download the file first.`,
    );
  }

  if (bytes.byteLength === 0) {
    throw new Error(`The image at '${filePath}' is empty. Pass a valid image file.`);
  }

  return {
    bytes,
    base64: bytes.toString("base64"),
    mimeType: mimeForPath(filePath),
    filePath,
    fileName: path.basename(filePath),
  };
}

/** Reads several source images in parallel, preserving input order. */
export function loadImages(paths: string[]): Promise<LoadedImage[]> {
  return Promise.all(paths.map(loadImage));
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
