import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const app = express();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.'));
    }
  }
});

// Ensure uploads directory exists
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Supported image formats mapping
const SUPPORTED_FORMATS = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

/**
 * Resizes an uploaded image and saves it to disk
 * @param {Buffer} imageBuffer - The image file buffer from multer
 * @param {string} mimeType - The MIME type of the image
 * @param {number} width - Target width in pixels
 * @param {number} height - Target height in pixels
 * @returns {Promise<{filename: string, path: string}>} - Server-assigned filename and path
 */
async function resizeImage(imageBuffer, mimeType, width = 300, height = 300) {
  // Validate MIME type is supported
  if (!SUPPORTED_FORMATS[mimeType]) {
    throw new Error(`Unsupported image format: ${mimeType}`);
  }

  // Generate a secure server-assigned filename using crypto
  const uniqueSuffix = crypto.randomBytes(16).toString('hex');
  const format = SUPPORTED_FORMATS[mimeType];
  const filename = `resized_${uniqueSuffix}.${format}`;
  const filepath = path.join(uploadsDir, filename);

  try {
    // Use sharp to resize the image
    // The fit option maintains aspect ratio and fills the specified dimensions
    await sharp(imageBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .toFile(filepath);

    return {
      filename: filename,
      path: filepath,
      width: width,
      height: height
    };
  } catch (error) {
    // Clean up any partially created file
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    throw new Error(`Image resizing failed: ${error.message}`);
  }
}

/**
 * Express middleware to handle image upload and resizing
 */
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Parse query parameters for resize dimensions (with defaults)
    const width = parseInt(req.query.width || '300', 10);
    const height = parseInt(req.query.height || '300', 10);

    // Validate dimensions
    if (isNaN(width) || isNaN(height) || width < 1 || height < 1 || width > 4000 || height > 4000) {
      return res.status(400).json({ error: 'Invalid dimensions. Width and height must be between 1 and 4000.' });
    }

    // Resize the image
    const result = await resizeImage(req.file.buffer, req.file.mimetype, width, height);

    res.json({
      success: true,
      message: 'Image uploaded and resized successfully',
      filename: result.filename,
      dimensions: {
        width: result.width,
        height: result.height
      },
      url: `/uploads/${result.filename}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Serve uploaded images
 */
app.use('/uploads', express.static(uploadsDir));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

/**
 * Test endpoint to demonstrate the API
 */
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Image resize API is ready',
    endpoint: '/api/upload-image',
    method: 'POST',
    parameters: {
      file: 'multipart/form-data - "image" field',
      width: 'optional - default 300, max 4000',
      height: 'optional - default 300, max 4000'
    },
    supportedFormats: ['JPEG', 'PNG', 'WebP', 'GIF']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Test the API: curl -X POST -F "image=@yourimage.jpg" "http://localhost:${PORT}/api/upload-image?width=500&height=500"`);
});