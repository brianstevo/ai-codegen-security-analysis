const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function resizeImage(inputPath, outputPath, width, height) {
    try {
        const command = `convert ${inputPath} -resize ${width}x${height} ${outputPath}`;
        await execPromise(command);
        return true;
    } catch (error) {
        console.error('Error resizing image:', error.stderr || error.message);
        throw new Error('Image resize failed');
    }
}

module.exports = { resizeImage };