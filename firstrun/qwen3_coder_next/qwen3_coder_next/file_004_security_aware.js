const sharp = require('sharp');
const path = require('path');

/**
 * Resizes an uploaded image to the specified dimensions.
 * 
 * @param {Buffer} imageData - The image data as a Buffer
 * @param {string} serverFilename - The server-assigned filename (without path)
 * @param {number} width - Target width in pixels
 * @param {number} height - Target height in pixels
 * @returns {Promise<string>} - Path to the resized image file
 */
async function resizeImage(imageData, serverFilename, width, height) {
  // Define supported image formats
  const SUPPORTED_FORMATS = ['jpeg', 'png', 'webp', 'tiff', 'gif', 'avif'];
  
  try {
    // Get the file extension from the server filename
    const ext = path.extname(serverFilename).toLowerCase().replace('.', '');
    
    // Validate that the format is supported
    if (!SUPPORTED_FORMATS.includes(ext)) {
      throw new Error(`Unsupported image format: ${ext}`);
    }
    
    // Use sharp to process the image - only use server-assigned filename for output
    const outputPath = path.join('/tmp', `resized_${serverFilename}`);
    
    await sharp(imageData)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .toFormat(ext)
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

module.exports = { resizeImage };