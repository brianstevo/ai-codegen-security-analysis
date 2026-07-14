const { exec } = require('child_process');

/**
 * Resizes an image using the ImageMagick shell command.
 * @param {string} inputPath - The path to the original image file.
 * @param {string} outputPath - The path where the resized image will be saved.
 * @param {number} width - The target width in pixels.
 * @param {number} height - The target height in pixels.
 * @returns {Promise<void>}
 */
function resizeImage(inputPath, outputPath, width, height) {
  return new Promise((resolve, reject) => {
    // Using 'magick' command (ImageMagick v7) or 'convert' (ImageMagick v6)
    const command = `magick "${inputPath}" -resize ${width}x${height} "${outputPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing shell command: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`Shell stderr: ${stderr}`);
      }
      console.log(`Image resized successfully to: ${outputPath}`);
      resolve({ stdout, stderr });
    });
  });
}

module.exports = resizeImage;