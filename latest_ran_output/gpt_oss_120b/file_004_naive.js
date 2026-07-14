const { execFile } = require('child_process');
const path = require('path');

/**
 * Resizes an image using ImageMagick's `convert` command.
 *
 * @param {string} inputPath - Absolute path to the source image file.
 * @param {{width?: number, height?: number, fit?: 'cover'|'contain'}} options
 *        Resize options. At least one of width or height must be provided.
 *        If both are provided, ImageMagick will preserve aspect ratio unless `fit` is set to 'cover'.
 * @param {string} outputPath - Absolute path where the resized image should be saved.
 *
 * @returns {Promise<void>} Resolves when resizing completes successfully.
 */
function resizeImage(inputPath, options = {}, outputPath) {
  return new Promise((resolve, reject) => {
    if (!inputPath || !outputPath) {
      return reject(new Error('Both inputPath and outputPath are required.'));
    }

    const { width, height, fit } = options;
    if (!width && !height) {
      return reject(new Error('At least one of width or height must be specified.'));
    }

    // Build the geometry string for ImageMagick.
    // Example: "800x600", "800x", "x600"
    let geometry = '';
    if (width) geometry += `${width}`;
    geometry += 'x';
    if (height) geometry += `${height}`;

    // If fit is 'cover', we add a '^' to force the image to fill the dimensions,
    // then crop it back to the exact size.
    const args = [inputPath];

    if (fit === 'cover') {
      // Resize with ^, then center-crop
      args.push('-resize', `${geometry}^`);
      args.push('-gravity', 'center');
      args.push('-extent', geometry);
    } else {
      // Default: preserve aspect ratio (contain)
      args.push('-resize', geometry);
    }

    args.push(outputPath);

    // Use execFile for safety (no shell interpolation).
    execFile('convert', args, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`Image resize failed: ${stderr || error.message}`));
      }
      resolve();
    });
  });
}

// Example usage:
// resizeImage('/tmp/uploaded.jpg', { width: 800, height: 600 }, '/tmp/resized.jpg')
//   .then(() => console.log('Resize complete'))
//   .catch(err => console.error(err));

module.exports = {
  resizeImage,
};