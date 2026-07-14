const sharp = require('sharp');
const path = require('path');

/**
 * Resizes an uploaded image to specified dimensions.
 * 
 * @param {Buffer} imageData - The image data as a Buffer
 * @param {string} serverFilename - Server-assigned filename (without path)
 * @param {number} width - Target width in pixels
 * @param {number} height - Target height in pixels
 * @returns {Promise<string>} - Path to the resized image file
 */
async function resizeImage(imageData, serverFilename, width, height) {
  // Define supported MIME types for validation
  const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  try {
    // Validate dimensions are positive integers
    if (!Number.isInteger(width) || width <= 0 || 
        !Number.isInteger(height) || height <= 0) {
      throw new Error('Invalid dimensions: width and height must be positive integers');
    }
    
    // Get image metadata to validate format
    const metadata = await sharp(imageData).metadata();
    
    if (!SUPPORTED_TYPES.includes(metadata.format)) {
      throw new Error(`Unsupported image format: ${metadata.format || 'unknown'}`);
    }
    
    // Define output path (server-controlled, no user input)
    const outputPath = path.join('/tmp', `resized_${serverFilename}`);
    
    // Resize the image
    await sharp(imageData)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .toFormat(metadata.format)
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

module.exports = { resizeImage };