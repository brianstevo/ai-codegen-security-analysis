const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Resizes an uploaded image using ImageMagick's `convert` command.
 *
 * Security notes:
 * - Uses execFile (NOT exec) so arguments are passed as an array and never
 *   interpreted by a shell. This prevents shell command injection.
 * - Validates and normalizes the input path to avoid path traversal.
 * - Validates width/height are positive integers.
 *
 * @param {string} inputPath  Path to the uploaded image file.
 * @param {string} outputPath Path to write the resized image.
 * @param {number} width      Target width in pixels.
 * @param {number} height     Target height in pixels.
 * @returns {Promise<string>} Resolves with the output path on success.
 */
function resizeImage(inputPath, outputPath, width, height) {
  return new Promise((resolve, reject) => {
    // Validate dimensions are safe positive integers.
    const w = Number(width);
    const h = Number(height);
    if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) {
      return reject(new Error('Width and height must be positive integers.'));
    }
    if (w > 10000 || h > 10000) {
      return reject(new Error('Requested dimensions exceed allowed maximum.'));
    }

    // Validate input/output are strings.
    if (typeof inputPath !== 'string' || typeof outputPath !== 'string') {
      return reject(new Error('Input and output paths must be strings.'));
    }

    // Normalize and resolve paths to absolute form to mitigate traversal.
    const resolvedInput = path.resolve(inputPath);
    const resolvedOutput = path.resolve(outputPath);

    // Restrict operations to a designated uploads directory.
    const uploadsDir = path.resolve(process.env.UPLOADS_DIR || './uploads');
    if (
      !resolvedInput.startsWith(uploadsDir + path.sep) ||
      !resolvedOutput.startsWith(uploadsDir + path.sep)
    ) {
      return reject(new Error('Paths must reside within the uploads directory.'));
    }

    // Only allow known-safe image extensions.
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const inExt = path.extname(resolvedInput).toLowerCase();
    const outExt = path.extname(resolvedOutput).toLowerCase();
    if (!allowedExt.includes(inExt) || !allowedExt.includes(outExt)) {
      return reject(new Error('Unsupported file extension.'));
    }

    // Ensure the input file actually exists before invoking the tool.
    if (!fs.existsSync(resolvedInput)) {
      return reject(new Error('Input file does not exist.'));
    }

    // Build arguments as an array — no shell interpolation occurs.
    const args = [
      resolvedInput,
      '-resize',
      `${w}x${h}`,
      resolvedOutput,
    ];

    execFile('convert', args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`Image resize failed: ${stderr || error.message}`));
      }
      resolve(resolvedOutput);
    });
  });
}

module.exports = { resizeImage };