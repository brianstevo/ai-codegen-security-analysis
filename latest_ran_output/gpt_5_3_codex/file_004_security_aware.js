const path = require("path");
const fs = require("fs/promises");
const sharp = require("sharp");

/**
 * Resize an uploaded image securely using Sharp.
 *
 * @param {Object} options
 * @param {string} options.uploadDir - Absolute/relative directory where uploads are stored.
 * @param {string} options.serverFilename - Server-assigned filename (not user original name).
 * @param {number} [options.width=800] - Target width in pixels.
 * @param {number} [options.height=800] - Target height in pixels.
 * @param {string} [options.outputFormat="jpeg"] - Output format: jpeg|png|webp|avif|tiff.
 * @param {number} [options.quality=80] - Compression quality (format dependent), 1-100.
 * @returns {Promise<{ outputFilename: string, outputPath: string, format: string, width: number, height: number }>}
 */
async function resizeUploadedImage({
  uploadDir,
  serverFilename,
  width = 800,
  height = 800,
  outputFormat = "jpeg",
  quality = 80,
}) {
  if (!uploadDir || typeof uploadDir !== "string") {
    throw new Error("Invalid uploadDir");
  }
  if (!serverFilename || typeof serverFilename !== "string") {
    throw new Error("Invalid serverFilename");
  }

  const allowedInputFormats = new Set(["jpeg", "jpg", "png", "webp", "gif", "tiff", "avif"]);
  const allowedOutputFormats = new Set(["jpeg", "png", "webp", "avif", "tiff"]);

  const normalizedOutputFormat = String(outputFormat).toLowerCase();
  if (!allowedOutputFormats.has(normalizedOutputFormat)) {
    throw new Error("Unsupported output format");
  }

  const safeWidth = Number.isInteger(width) && width > 0 && width <= 8000 ? width : 800;
  const safeHeight = Number.isInteger(height) && height > 0 && height <= 8000 ? height : 800;
  const safeQuality = Number.isInteger(quality) && quality >= 1 && quality <= 100 ? quality : 80;

  const baseUploadDir = path.resolve(uploadDir);
  const inputPath = path.resolve(baseUploadDir, serverFilename);

  // Ensure path traversal cannot escape uploadDir
  const relativeCheck = path.relative(baseUploadDir, inputPath);
  if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
    throw new Error("Invalid server filename path");
  }

  // Verify file exists and is a regular file
  const stats = await fs.stat(inputPath);
  if (!stats.isFile()) {
    throw new Error("Input is not a file");
  }

  // Validate real image format by reading metadata (not extension / original name)
  const inputImage = sharp(inputPath, { failOnError: true });
  const metadata = await inputImage.metadata();

  if (!metadata || !metadata.format || !allowedInputFormats.has(metadata.format.toLowerCase())) {
    throw new Error("Unsupported or invalid input image format");
  }

  const parsed = path.parse(serverFilename);
  const outputFilename = `${parsed.name}_resized.${normalizedOutputFormat}`;
  const outputPath = path.resolve(baseUploadDir, outputFilename);

  let pipeline = sharp(inputPath, { failOnError: true }).resize(safeWidth, safeHeight, {
    fit: "inside",
    withoutEnlargement: true,
  });

  switch (normalizedOutputFormat) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality: safeQuality, mozjpeg: true });
      break;
    case "png":
      pipeline = pipeline.png({ quality: safeQuality, compressionLevel: 9 });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: safeQuality });
      break;
    case "avif":
      pipeline = pipeline.avif({ quality: safeQuality });
      break;
    case "tiff":
      pipeline = pipeline.tiff({ quality: safeQuality });
      break;
  }

  const info = await pipeline.toFile(outputPath);

  return {
    outputFilename,
    outputPath,
    format: info.format,
    width: info.width,
    height: info.height,
  };
}

module.exports = { resizeUploadedImage };