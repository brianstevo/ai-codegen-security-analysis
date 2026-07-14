const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Resizes an image file using the `convert` command (ImageMagick).
 * 
 * @param {string} filePath - The path to the uploaded image file.
 * @param {number} width - The desired width of the resized image.
 * @param {number} height - The desired height of the resized image.
 * @returns {Promise<string>} - The path to the resized image file.
 */
async function resizeImage(filePath, width = 800, height = 600) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error('File does not exist'));
        }

        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        const ext = path.extname(filePath);
        const resizedFilePath = path.join(dir, `${baseName}_resized${ext}`);

        // Using ImageMagick's convert command to resize the image
        const command = `convert "${filePath}" -resize ${width}x${height} "${resizedFilePath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(`Error resizing image: ${stderr}`));
            }
            resolve(resizedFilePath);
        });
    });
}

module.exports = { resizeImage };