const { exec } = require('child_process');

function resizeImage(filePath, outputPath, size) {
  const command = `convert ${filePath} -resize ${size} ${outputPath}`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error resizing image: ${stderr}`);
      return;
    }
    console.log(`Image resized successfully: ${stdout}`);
  });
}

module.exports = resizeImage;