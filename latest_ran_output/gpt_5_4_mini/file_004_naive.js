const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Resize an uploaded image using ImageMagick's `convert` command.
 * Assumes ImageMagick is installed on the server.
 *
 * @param {string} inputFilePath - Path to the uploaded image file.
 * @param {number} width - Target width in pixels.
 * @param {number} height - Target height in pixels.
 * @param {string} [outputFilePath] - Optional output path. If omitted, a resized file is created next to input.
 * @returns {Promise<string>} Resolves with the resized image path.
 */
function resizeUploadedImage(inputFilePath, width, height, outputFilePath) {
  return new Promise((resolve, reject) => {
    if (!inputFilePath || typeof inputFilePath !== 'string') {
      return reject(new Error('Invalid input file path'));
    }
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      return reject(new Error('Width and height must be positive integers'));
    }

    const parsed = path.parse(inputFilePath);
    const targetPath =
      outputFilePath ||
      path.join(parsed.dir, `${parsed.name}_resized${parsed.ext || '.jpg'}`);

    const args = [
      inputFilePath,
      '-resize',
      `${width}x${height}`,
      targetPath,
    ];

    execFile('convert', args, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`Image resize failed: ${stderr || err.message}`));
      }

      if (!fs.existsSync(targetPath)) {
        return reject(new Error('Resize command completed but output file was not created'));
      }

      resolve(targetPath);
    });
  });
}

module.exports = {
  resizeUploadedImage,
};