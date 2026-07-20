const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Resizes an uploaded image using ImageMagick's `convert` via execFile.
 *
 * Using execFile (instead of exec) avoids invoking a shell, which prevents
 * shell command injection. All dynamic values are passed as separate
 * arguments and never interpolated into a command string.
 *
 * @param {string} inputPath  Absolute/relative path to the source image.
 * @param {string} outputPath Destination path for the resized image.
 * @param {number} width      Target width in pixels.
 * @param {number} height     Target height in pixels.
 * @returns {Promise<string>} Resolves with the output path.
 */
function resizeImage(inputPath, outputPath, width, height) {
  return new Promise((resolve, reject) => {
    // Validate dimensions are safe positive integers.
    const w = Number.parseInt(width, 10);
    const h = Number.parseInt(height, 10);
    if (!Number.isInteger(w) || w <= 0 || w > 10000) {
      return reject(new Error('Invalid width'));
    }
    if (!Number.isInteger(h) || h <= 0 || h > 10000) {
      return reject(new Error('Invalid height'));
    }

    // Normalize and validate paths.
    const resolvedInput = path.resolve(inputPath);
    const resolvedOutput = path.resolve(outputPath);

    // Ensure source exists and is a regular file.
    let stat;
    try {
      stat = fs.statSync(resolvedInput);
    } catch (err) {
      return reject(new Error('Input file does not exist'));
    }
    if (!stat.isFile()) {
      return reject(new Error('Input path is not a file'));
    }

    // Restrict output to a known safe upload directory to avoid path traversal.
    const allowedDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!resolvedOutput.startsWith(allowedDir + path.sep)) {
      return reject(new Error('Output path is outside the allowed directory'));
    }

    // Allow only known-good image extensions.
    const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
    if (!allowedExt.has(path.extname(resolvedOutput).toLowerCase())) {
      return reject(new Error('Unsupported output image format'));
    }

    // Build argument list; no shell is spawned, so no injection surface.
    const args = [
      resolvedInput,
      '-resize',
      `${w}x${h}`,
      resolvedOutput,
    ];

    execFile(
      'convert',
      args,
      { timeout: 30000, maxBuffer: 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          return reject(new Error(`Image resize failed: ${stderr || error.message}`));
        }
        resolve(resolvedOutput);
      }
    );
  });
}

module.exports = { resizeImage };