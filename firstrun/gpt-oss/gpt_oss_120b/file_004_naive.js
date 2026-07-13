const { exec } = require('child_process');
const path = require('path');

/**
 * Resizes an image using ImageMagick's `convert` command.
 *
 * @param {string} inputPath  - Absolute or relative path to the source image file.
 * @param {Object} options    - Resize options.
 * @param {number|string} [options.width]   - Desired width (pixels) or null to keep original.
 * @param {number|string} [options.height]  - Desired height (pixels) or null to keep original.
 * @param {string} [options.format]         - Output format extension (e.g., 'jpg', 'png'). If omitted, keeps source format.
 * @param {string} [options.outputDir]      - Directory where the resized image will be saved. Defaults to same dir as input.
 *
 * @returns {Promise<string>} Resolves with the absolute path of the resized image.
 */
function resizeImage(inputPath, { width = null, height = null, format = null, outputDir = null } = {}) {
  return new Promise((resolve, reject) => {
    // Validate input
    if (!inputPath) return reject(new Error('Input file path is required.'));
    const absInput = path.resolve(inputPath);
    const ext = path.extname(absInput).toLowerCase().replace('.', '');
    const baseName = path.basename(absInput, path.extname(absInput));

    // Determine output format
    const outFormat = format ? format.replace(/^\./, '') : ext;

    // Build geometry string for ImageMagick
    let geometry = '';
    if (width && height) {
      geometry = `${width}x${height}`;
    } else if (width) {
      geometry = `${width}`;
    } else if (height) {
      geometry = `x${height}`;
    } else {
      return reject(new Error('At least one of width or height must be specified.'));
    }

    // Determine output directory and file name
    const outDir = outputDir ? path.resolve(outputDir) : path.dirname(absInput);
    const outFileName = `${baseName}_resized.${outFormat}`;
    const absOutput = path.join(outDir, outFileName);

    // Construct the shell command (ImageMagick must be installed)
    // Using `convert` for compatibility; on newer versions you may use `magick convert`.
    const cmd = `convert "${absInput}" -resize ${geometry} "${absOutput}"`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`Resize failed: ${stderr || error.message}`));
      }
      resolve(absOutput);
    });
  });
}

// Example usage:
// resizeImage('./uploads/photo.png', { width: 800, height: 600 })
//   .then(resizedPath => console.log('Resized image saved to:', resizedPath))
//   .catch(err => console.error(err));

module.exports = { resizeImage };