const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * Resize an uploaded image safely using sharp.
 * - Uses the server-assigned filename, not the original filename.
 * - Validates the file is a supported image format before processing.
 * - Does not invoke any shell commands.
 *
 * @param {Object} file - Multer file object (expects { filename, path, mimetype, ... }).
 * @param {Object} [options]
 * @param {number} [options.width=800]
 * @param {number} [options.height=800]
 * @param {string} [options.outputDir] - Directory to write resized image into.
 * @returns {Promise<{ inputPath: string, outputPath: string, format: string, width: number, height: number }>}
 */
async function resizeUploadedImage(file, options = {}) {
  if (!file || typeof file !== 'object') {
    throw new Error('Invalid file object');
  }

  const { width = 800, height = 800, outputDir } = options;

  if (!Number.isInteger(width) || width <= 0 || width > 10000) {
    throw new Error('Invalid width');
  }

  if (!Number.isInteger(height) || height <= 0 || height > 10000) {
    throw new Error('Invalid height');
  }

  const allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/tiff',
    'image/avif',
    'image/heif',
    'image/heic'
  ]);

  if (!file.mimetype || !allowedMimeTypes.has(file.mimetype)) {
    throw new Error('Unsupported image format');
  }

  if (!file.filename || typeof file.filename !== 'string') {
    throw new Error('Missing server-assigned filename');
  }

  const uploadDir = path.resolve(process.cwd(), 'uploads');
  const safeOutputDir = path.resolve(outputDir || uploadDir);

  if (!safeOutputDir.startsWith(uploadDir)) {
    throw new Error('Invalid output directory');
  }

  const inputPath = path.resolve(uploadDir, file.filename);

  if (!inputPath.startsWith(uploadDir)) {
    throw new Error('Invalid input path');
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error('Uploaded file not found');
  }

  const image = sharp(inputPath, { failOnError: true });
  const metadata = await image.metadata();

  if (!metadata.format || !allowedMimeTypes.has(`image/${metadata.format}`) && !(
    metadata.format === 'jpg' && file.mimetype === 'image/jpeg'
  )) {
    throw new Error('Unsupported or invalid image content');
  }

  const outputFormat = metadata.format === 'jpg' ? 'jpeg' : metadata.format;
  const baseName = path.parse(file.filename).name;
  const outputFilename = `${baseName}-resized.${outputFormat === 'jpeg' ? 'jpg' : outputFormat}`;
  const outputPath = path.resolve(safeOutputDir, outputFilename);

  await fs.promises.mkdir(safeOutputDir, { recursive: true });

  await sharp(inputPath, { failOnError: true })
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .toFormat(outputFormat)
    .toFile(outputPath);

  return {
    inputPath,
    outputPath,
    format: outputFormat,
    width,
    height
  };
}

module.exports = {
  resizeUploadedImage
};