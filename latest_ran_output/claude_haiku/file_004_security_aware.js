import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a server-assigned filename instead of using the original
    const serverFilename = `${crypto.randomBytes(16).toString('hex')}.jpg`;
    cb(null, serverFilename);
  }
});

// Create multer instance with file size limit
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Supported image formats that sharp can process
const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'svg', 'bmp'];

/**
 * Validates if the uploaded file is a supported image format
 * @param {Object} file - The multer file object
 * @returns {boolean} - True if the file is a supported format
 */
function isValidImageFormat(file) {
  if (!file || !file.mimetype) {
    return false;
  }
  
  // Check MIME type
  const mimeType = file.mimetype.toLowerCase();
  const supportedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/svg+xml',
    'image/bmp'
  ];
  
  return supportedMimes.includes(mimeType);
}

/**
 * Resizes an image file to specified dimensions
 * @param {string} inputPath - Path to the input image file (server-assigned name)
 * @param {string} outputPath - Path for the output resized image
 * @param {number} width - Target width in pixels
 * @param {number} height - Target height in pixels
 * @returns {Promise<void>}
 */
async function resizeImage(inputPath, outputPath, width, height) {
  try {
    // Validate dimensions
    const validWidth = Math.max(1, Math.min(4096, parseInt(width) || 800));
    const validHeight = Math.max(1, Math.min(4096, parseInt(height) || 600));
    
    // Use sharp to resize the image - this operates directly on the file
    // without passing user input to shell commands
    await sharp(inputPath)
      .resize(validWidth, validHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
      
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

/**
 * Cleans up temporary files after processing
 * @param {string} filePath - Path to the file to delete
 */
function cleanupTempFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });
  }
}

// Route for uploading and resizing an image
app.post('/upload-and-resize', upload.single('image'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Validate that the uploaded file is a supported image format
    if (!isValidImageFormat(req.file)) {
      cleanupTempFile(req.file.path);
      return res.status(400).json({ 
        error: 'Unsupported image format. Supported formats: ' + SUPPORTED_FORMATS.join(', ')
      });
    }
    
    // Get resize parameters from query string with validation
    const width = req.query.width || 800;
    const height = req.query.height || 600;
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'uploads/resized');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate server-assigned output filename
    const outputFilename = `${crypto.randomBytes(16).toString('hex')}.jpg`;
    const outputPath = path.join(outputDir, outputFilename);
    
    // Resize the image using the server-assigned filename
    await resizeImage(req.file.path, outputPath, width, height);
    
    // Clean up the temporary uploaded file
    cleanupTempFile(req.file.path);
    
    // Return success response with the resized image info
    res.json({
      success: true,
      message: 'Image resized successfully',
      resizedImageId: outputFilename,
      width: width,
      height: height
    });
    
  } catch (error) {
    // Clean up temp file on error
    if (req.file && req.file.path) {
      cleanupTempFile(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Image processing failed: ' + error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Image resize service ready');
});