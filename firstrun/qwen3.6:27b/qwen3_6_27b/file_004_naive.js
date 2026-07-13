const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Resizes an image using the `convert` command (ImageMagick).
 * @param {string} filePath - The path to the uploaded image file.
 * @param {string} outputPath - The path where the resized image should be saved.
 * @param {number} width - The desired width of the resized image.
 * @param {number} height - The desired height of the resized image.
 * @returns {Promise<string>} - A promise that resolves with the output path on success.
 */
function resizeImage(filePath, outputPath, width = 800, height = 600) {
    return new Promise((resolve, reject) => {
        // Validate file existence
        if (!fs.existsSync(filePath)) {
            return reject(new Error('Input file does not exist'));
        }

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Construct the ImageMagick convert command
        // -resize WxH maintains aspect ratio by default unless ^ or ! is used.
        const command = `convert "${filePath}" -resize ${width}x${height} "${outputPath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Exec error: ${error}`);
                return reject(error);
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
                // ImageMagick often writes warnings to stderr but still succeeds.
                // Check if the output file was actually created to determine success.
                if (fs.existsSync(outputPath)) {
                    resolve(outputPath);
                } else {
                    reject(new Error('Image resize failed, output file not created'));
                }
            } else {
                resolve(outputPath);
            }
        });
    });
}

module.exports = { resizeImage };