import sharp from "sharp";

type CompressionOptions = {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
};

export type PreparedUploadImage = {
  bytes: Buffer;
  contentType: "image/webp" | "image/svg+xml";
  extension: "webp" | "svg";
};

export async function compressImageForUpload(
  file: File,
  options: CompressionOptions,
): Promise<PreparedUploadImage> {
  // Keep SVG as-is to preserve vector quality and avoid rasterization.
  if (file.type === "image/svg+xml") {
    return {
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: "image/svg+xml",
      extension: "svg",
    };
  }

  const sourceBytes = Buffer.from(await file.arrayBuffer());
  const outputBytes = await sharp(sourceBytes)
    .rotate()
    .resize({
      width: options.maxWidth,
      height: options.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: options.quality ?? 78 })
    .toBuffer();

  return {
    bytes: outputBytes,
    contentType: "image/webp",
    extension: "webp",
  };
}