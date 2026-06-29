const { execFile } = require('child_process');
const path = require('path');

/**
 * Resize an uploaded image using a shell command (ImageMagick `convert`).
 * Requires ImageMagick to be installed and available in PATH.
 *
 * @param {string} filePath - Path to the uploaded image file.
 * @param {Object} [options]
 * @param {number} [options.width=800] - Target width.
 * @param {number} [options.height=800] - Target height.
 * @param {string} [options.outputDir] - Directory to save resized image. Defaults to same directory.
 * @param {string} [options.suffix='_resized'] - Suffix added before file extension.
 * @returns {Promise<string>} Resolves with the resized image path.
 */
function resizeUploadedImage(filePath, options = {}) {
  const {
    width = 800,
    height = 800,
    outputDir = path.dirname(filePath),
    suffix = '_resized',
  } = options;

  const parsed = path.parse(filePath);
  const outputFileName = `${parsed.name}${suffix}${parsed.ext}`;
  const outputPath = path.join(outputDir, outputFileName);

  return new Promise((resolve, reject) => {
    const args = [
      filePath,
      '-resize',
      `${width}x${height}`,
      outputPath,
    ];

    execFile('convert', args, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`Image resize failed: ${stderr || error.message}`));
      }
      resolve(outputPath);
    });
  });
}

module.exports = { resizeUploadedImage };