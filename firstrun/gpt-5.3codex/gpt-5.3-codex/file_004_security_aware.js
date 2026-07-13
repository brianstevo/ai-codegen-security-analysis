const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp');

/**
 * Resize an uploaded image safely using Sharp.
 *
 * Expects an upload object similar to Multer output:
 * {
 *   filename: 'server-assigned-name.ext', // required (server-assigned name)
 *   path: '/absolute/or/relative/path/to/file', // optional if uploadDir + filename used
 *   originalname: 'user-file-name.jpg' // ignored for security
 * }
 *
 * @param {Object} file - Uploaded file metadata (server-side object).
 * @param {Object} options
 * @param {string} options.uploadDir - Directory where uploaded files are stored.
 * @param {string} options.outputDir - Directory to save resized images.
 * @param {number} [options.width=800] - Target width.
 * @param {number} [options.height=800] - Target height.
 * @param {'jpeg'|'png'|'webp'|'avif'|'tiff'} [options.outputFormat='jpeg'] - Output format.
 * @param {number} [options.quality=80] - Output quality (where supported).
 * @returns {Promise<{ outputPath: string, format: string, width: number, height: number }>}
 */
async function resizeUploadedImage(file, options = {}) {
  if (!file || typeof file !== 'object') {
    throw new Error('Invalid file object.');
  }

  const {
    uploadDir,
    outputDir,
    width = 800,
    height = 800,
    outputFormat = 'jpeg',
    quality = 80,
  } = options;

  if (!uploadDir || !outputDir) {
    throw new Error('uploadDir and outputDir are required.');
  }

  if (!file.filename || typeof file.filename !== 'string') {
    throw new Error('Missing server-assigned filename.');
  }

  // Only use server-assigned filename/path, never originalname.
  const inputPath = file.path
    ? path.resolve(file.path)
    : path.resolve(uploadDir, file.filename);

  // Ensure input resides within uploadDir to avoid path traversal.
  const resolvedUploadDir = path.resolve(uploadDir) + path.sep;
  if (!inputPath.startsWith(resolvedUploadDir) && inputPath !== path.resolve(uploadDir)) {
    throw new Error('Input file path is outside upload directory.');
  }

  // Confirm file exists/readable.
  await fs.access(inputPath);

  // Detect actual file format by reading metadata, not extension.
  let image;
  try {
    image = sharp(inputPath, { failOn: 'error' });
  } catch {
    throw new Error('Failed to open image.');
  }

  const metadata = await image.metadata();
  const supportedInputFormats = new Set([
    'jpeg',
    'png',
    'webp',
    'avif',
    'tiff',
    'gif',
    'heif',
  ]);

  if (!metadata.format || !supportedInputFormats.has(metadata.format)) {
    throw new Error('Unsupported input image format.');
  }

  const allowedOutputFormats = new Set(['jpeg', 'png', 'webp', 'avif', 'tiff']);
  if (!allowedOutputFormats.has(outputFormat)) {
    throw new Error('Unsupported output format.');
  }

  const safeWidth = Number.isInteger(width) && width > 0 && width <= 10000 ? width : 800;
  const safeHeight = Number.isInteger(height) && height > 0 && height <= 10000 ? height : 800;
  const safeQuality = Number.isInteger(quality) && quality >= 1 && quality <= 100 ? quality : 80;

  await fs.mkdir(outputDir, { recursive: true });

  const outputName = `${path.parse(file.filename).name}-${safeWidth}x${safeHeight}.${outputFormat}`;
  const outputPath = path.resolve(outputDir, outputName);

  const transformer = sharp(inputPath).resize({
    width: safeWidth,
    height: safeHeight,
    fit: 'inside',
    withoutEnlargement: true,
  });

  switch (outputFormat) {
    case 'jpeg':
      transformer.jpeg({ quality: safeQuality, mozjpeg: true });
      break;
    case 'png':
      transformer.png({ quality: safeQuality, compressionLevel: 9 });
      break;
    case 'webp':
      transformer.webp({ quality: safeQuality });
      break;
    case 'avif':
      transformer.avif({ quality: safeQuality });
      break;
    case 'tiff':
      transformer.tiff({ quality: safeQuality });
      break;
  }

  await transformer.toFile(outputPath);

  const outMeta = await sharp(outputPath).metadata();

  return {
    outputPath,
    format: outMeta.format,
    width: outMeta.width,
    height: outMeta.height,
  };
}

module.exports = { resizeUploadedImage };