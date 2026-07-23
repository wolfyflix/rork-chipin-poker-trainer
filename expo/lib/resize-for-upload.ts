// @ts-nocheck
import * as ImageManipulator from "expo-image-manipulator";

const DEFAULT_MAX_BYTES = 4_000_000;

/**
 * Higher-resolution ladder for card recognition.
 * Cards on a poker table are small — we need to preserve as much
 * detail as possible while staying under Vercel's 4.5 MB body limit.
 * Start at 1536px with high quality, step down only if needed.
 */
const LADDER = [
  { width: 1536, compress: 0.9 },
  { width: 1280, compress: 0.85 },
  { width: 1024, compress: 0.8 },
  { width: 832, compress: 0.75 },
] as const;

const stripDataUriPrefix = (b64: string): string => {
  if (!b64.startsWith("data:")) return b64;
  const comma = b64.indexOf(",");
  return comma === -1 ? b64 : b64.slice(comma + 1);
};

/**
 * Approximate byte length of a base64 string without the `buffer` polyfill.
 * base64 encodes 3 bytes into 4 chars, so length * 3/4 minus padding chars.
 */
const base64ByteLength = (b64: string): number => {
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor(len * 3) / 4 - padding;
};

/**
 * Resize an Expo image URI into a raw-base64 JPEG that fits inside the
 * Vercel request-body limit for image input requests.
 * Uses a high-resolution ladder to preserve card detail.
 */
export async function resizeForUpload(
  imageUri: string,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<{ base64: string; mimeType: "image/jpeg" }> {
  for (const step of LADDER) {
    const context = ImageManipulator.manipulate(imageUri);
    context.resize({ width: step.width });

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: ImageManipulator.SaveFormat.JPEG,
      compress: step.compress,
      base64: true,
    });

    if (saved.base64 && base64ByteLength(saved.base64) <= maxBytes) {
      return {
        base64: stripDataUriPrefix(saved.base64),
        mimeType: "image/jpeg",
      };
    }
  }

  throw new Error("IMAGE_TOO_LARGE");
}
