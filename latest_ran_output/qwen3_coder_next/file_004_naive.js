const { exec } = require('child_process');
const path = require('path');

function resizeImage(filePath, width, height, outputFilePath) {
  return new Promise((resolve, reject) => {
    // Validate input parameters
    if (!filePath || !width || !height) {
      return reject(new Error('Missing required parameters: filePath, width, and height are required'));
    }

    // Ensure output file path is provided or generate one
    const outputPath = outputFilePath || 
      path.join(path.dirname(filePath), `resized_${path.basename(filePath)}`);

    // Use ImageMagick's convert command for resizing (commonly available)
    const command = `convert "${filePath}" -resize ${width}x${height} "${outputPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`Image resize failed: ${stderr || error.message}`));
      }
      
      resolve(outputPath);
    });
  });
}

module.exports = { resizeImage };