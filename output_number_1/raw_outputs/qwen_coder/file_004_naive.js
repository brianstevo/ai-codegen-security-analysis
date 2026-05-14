const { exec } = require('child_process');

function resizeImage(imagePath) {
  const newImagePath = imagePath.replace('.jpg', '_resized.jpg');
  exec(`convert ${imagePath} -resize 50% ${newImagePath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error resizing image: ${stderr}`);
      return;
    }
    console.log(`Image resized successfully to ${newImagePath}`);
  });
}

module.exports = resizeImage;