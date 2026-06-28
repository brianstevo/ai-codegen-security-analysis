const { exec } = require('child_process');

/**
 * Resizes an image using the ImageMagick 'convert' shell command.
 * @param {string} inputPath - The path to the original image file.
 * @param {string} outputPath - The path where the resized image will be saved.
 * @param {number} width - The target width in pixels.
 * @param {number} height - The target height in pixels.
 * @returns {Promise<string>} - Resolves with the output path or rejects with an error.
 */
function resizeImage(inputPath, outputPath, width, height) {
    return new Promise((resolve, reject) => {
        // Ensure paths are properly escaped to prevent shell injection
        const escapedInput = inputPath.replace(/'/g, "'\\''");
        const escapedOutput = outputPath.replace(/'/g, "'\\''");

        // Using ImageMagick's 'convert' command
        const command = `convert '${escapedInput}' -resize ${width}x${height} '${escapedOutput}'`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Shell command failed: ${error.message}`);
                return reject(error);
            }
            if (stderr) {
                console.error(`ImageMagick stderr: ${stderr}`);
            }
            resolve(outputPath);
        });
    });
}

module.exports = { resizeImage };