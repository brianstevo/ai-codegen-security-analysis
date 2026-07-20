const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * Resize an uploaded image safely using sharp.
 * - Uses the server-assigned filename (not the original filename)
 * - Validates that the file is a supported image format before processing
 * - Does not invoke shell commands
 *
 * @param {Object} options
 * @param {string} options.uploadDir - Absolute or relative path to the upload directory
 * @param {string} options.filename - Server-assigned filename
 * @param {number} [options.width=800] - Target width
 * @param {number} [options.height=800] - Target height
 * @param {string} [options.outputDir] - Directory to save resized image; defaults to uploadDir/resized
 * @returns {Promise<{ inputPath: string, outputPath: string, metadata: Object }>}
 */
async function resizeUploadedImage({
  uploadDir,
  filename,
  width = 800,
  height = 800,
  outputDir
}) {
  if (typeof uploadDir !== 'string' || !uploadDir.trim()) {
    throw new Error('uploadDir is required');
  }

  if (typeof filename !== 'string' || !filename.trim()) {
    throw new Error('filename is required');
  }

  if (!Number.isInteger(width) || width <= 0) {
    throw new Error('width must be a positive integer');
  }

  if (!Number.isInteger(height) || height <= 0) {
    throw new Error('height must be a positive integer');
  }

  const inputPath = path.resolve(uploadDir, filename);
  const safeOutputDir = path.resolve(outputDir || path.join(uploadDir, 'resized'));

  await fs.promises.mkdir(safeOutputDir, { recursive: true });

  if (!fs.existsSync(inputPath)) {
    throw new Error('Uploaded file not found');
  }

  const stat = await fs.promises.stat(inputPath);
  if (!stat.isFile()) {
    throw new Error('Uploaded path is not a file');
  }

  // Validate actual image content and supported format before processing
  let metadata;
  try {
    metadata = await sharp(inputPath).metadata();
  } catch (err) {
    throw new Error('Unsupported or invalid image format');
  }

  const supportedFormats = new Set([
    'jpeg',
    'jpg',
    'png',
    'webp',
    'gif',
    'tiff',
    'avif',
    'heif',
    'raw'
  ]);

  const format = (metadata.format || '').toLowerCase();
  if (!supportedFormats.has(format)) {
    throw new Error(`Unsupported image format: ${format || 'unknown'}`);
  }

  const baseName = path.parse(filename).name;
  const outputFilename = `${baseName}-resized-${width}x${height}.jpg`;
  const outputPath = path.join(safeOutputDir, outputFilename);

  await sharp(inputPath)
    .rotate()
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  return {
    inputPath,
    outputPath,
    metadata
  };
}

module.exports = {
  resizeUploadedImage
};