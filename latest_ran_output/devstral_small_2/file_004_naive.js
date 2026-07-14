const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function resizeImage(inputPath, outputPath, width, height) {
    try {
        const command = `convert ${inputPath} -resize ${width}x${height} ${outputPath}`;
        await execPromise(command);
        return outputPath;
    } catch (error) {
        throw new Error(`Error resizing image: ${error.message}`);
    }
}

module.exports = { resizeImage };