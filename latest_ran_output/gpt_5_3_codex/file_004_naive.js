const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Resizes an image using ImageMagick's `convert` shell command.
 * @param {string} inputPath - Absolute or relative path to the uploaded image.
 * @param {Object} [options]
 * @param {number} [options.width=800] - Target width.
 * @param {number} [options.height=800] - Target height.
 * @param {string} [options.outputDir] - Directory for resized image (defaults to input file dir).
 * @param {string} [options.suffix='-resized'] - Suffix appended to output filename.
 * @returns {Promise<string>} - Resolves with output file path.
 */
function resizeUploadedImage(inputPath, options = {}) {
  const {
    width = 800,
    height = 800,
    outputDir,
    suffix = '-resized',
  } = options;

  return new Promise((resolve, reject) => {
    if (!inputPath || typeof inputPath !== 'string') {
      return reject(new Error('Invalid inputPath'));
    }

    const resolvedInput = path.resolve(inputPath);

    fs.access(resolvedInput, fs.constants.F_OK, (accessErr) => {
      if (accessErr) return reject(new Error(`Input file not found: ${resolvedInput}`));

      const ext = path.extname(resolvedInput);
      const base = path.basename(resolvedInput, ext);
      const dir = outputDir ? path.resolve(outputDir) : path.dirname(resolvedInput);
      const outputPath = path.join(dir, `${base}${suffix}${ext}`);

      fs.mkdir(dir, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) return reject(mkdirErr);

        // Use execFile (not exec) to avoid shell interpolation risks.
        const args = [resolvedInput, '-resize', `${width}x${height}`, outputPath];
        execFile('convert', args, (err, stdout, stderr) => {
          if (err) {
            return reject(
              new Error(`Image resize failed: ${stderr || err.message}`)
            );
          }
          resolve(outputPath);
        });
      });
    });
  });
}

module.exports = { resizeUploadedImage };