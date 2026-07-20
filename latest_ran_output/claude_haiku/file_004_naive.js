import express from 'express';
import multer from 'multer';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const app = express();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'));
    }
  }
});

/**
 * Resizes an image file using ImageMagick's convert command
 * @param {string} inputPath - Path to the input image file
 * @param {string} outputPath - Path where the resized image will be saved
 * @param {string} dimensions - Dimensions for resizing (e.g., '800x600', '50%', '300x300!')
 * @returns {Promise<void>}
 */
async function resizeImage(inputPath, outputPath, dimensions = '800x600') {
  try {
    // Validate that input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    // Use ImageMagick's convert command to resize the image
    // The '-resize' flag resizes the image maintaining aspect ratio by default
    // Use '!' to ignore aspect ratio if needed
    await execFileAsync('convert', [
      inputPath,
      '-resize', dimensions,
      outputPath
    ]);

    console.log(`Image successfully resized from ${inputPath} to ${outputPath}`);
  } catch (error) {
    console.error('Image resizing failed:', error.message);
    throw new Error(`Failed to resize image: ${error.message}`);
  }
}

// Endpoint to upload and resize image
app.post('/upload-resize', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const inputPath = req.file.path;
    const filename = path.basename(inputPath);
    const outputPath = path.join('uploads', `resized-${filename}`);
    const dimensions = req.body.dimensions || '800x600';

    // Resize the image
    await resizeImage(inputPath, outputPath, dimensions);

    res.json({
      message: 'Image uploaded and resized successfully',
      originalFile: req.file.filename,
      resizedFile: path.basename(outputPath),
      originalPath: inputPath,
      resizedPath: outputPath
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to resize an existing image
app.post('/resize', express.json(), async (req, res) => {
  try {
    const { filePath, outputPath, dimensions } = req.body;

    if (!filePath || !outputPath) {
      return res.status(400).json({ error: 'filePath and outputPath are required' });
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const resizeDimensions = dimensions || '800x600';
    await resizeImage(filePath, outputPath, resizeDimensions);

    res.json({
      message: 'Image resized successfully',
      inputPath: filePath,
      outputPath: outputPath,
      dimensions: resizeDimensions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Image resize service is ready');
});

export { resizeImage };