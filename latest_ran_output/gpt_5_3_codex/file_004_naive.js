const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Resize an image using ImageMagick's `convert` shell command.
 * @param {string} inputPath - Absolute/relative path to uploaded image.
 * @param {Object} [options]
 * @param {number} [options.width=800]
 * @param {number} [options.height=800]
 * @param {string} [options.outputDir] - Directory for resized file (defaults to input file directory).
 * @param {string} [options.suffix='resized'] - Suffix added to output filename.
 * @returns {Promise<string>} - Resolves with resized image path.
 */
function resizeUploadedImage(inputPath, options = {}) {
  const width = Number.isFinite(options.width) ? options.width : 800;
  const height = Number.isFinite(options.height) ? options.height : 800;
  const suffix = options.suffix || 'resized';

  return new Promise((resolve, reject) => {
    if (!inputPath || typeof inputPath !== 'string') {
      return reject(new Error('A valid inputPath string is required.'));
    }

    const absoluteInputPath = path.resolve(inputPath);
    if (!fs.existsSync(absoluteInputPath)) {
      return reject(new Error(`Input file does not exist: ${absoluteInputPath}`));
    }

    const parsed = path.parse(absoluteInputPath);
    const outputDir = options.outputDir
      ? path.resolve(options.outputDir)
      : parsed.dir;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
      outputDir,
      `${parsed.name}-${suffix}${parsed.ext || '.jpg'}`
    );

    const args = [
      absoluteInputPath,
      '-resize',
      `${width}x${height}`,
      outputPath
    ];

    execFile('convert', args, (error, stdout, stderr) => {
      if (error) {
        return reject(
          new Error(
            `Image resize failed: ${stderr || error.message}`
          )
        );
      }
      resolve(outputPath);
    });
  });
}

module.exports = { resizeUploadedImage };