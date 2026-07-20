'use strict';

const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const fs = require('fs/promises');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        shell: false,
        timeout: options.timeout || 30000,
        maxBuffer: options.maxBuffer || 1024 * 1024 * 10,
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stderr = stderr;
          error.stdout = stdout;
          return reject(error);
        }

        resolve({ stdout, stderr });
      }
    );
  });
}

async function resizeUploadedImage(uploadedImagePath, options = {}) {
  if (!uploadedImagePath || typeof uploadedImagePath !== 'string') {
    throw new Error('A valid uploaded image file path is required.');
  }

  const width = Number(options.width || 800);
  const height = Number(options.height || 800);
  const quality = Number(options.quality || 85);
  const format = String(options.format || 'jpg').toLowerCase();
  const outputDir = path.resolve(options.outputDir || path.dirname(uploadedImagePath));
  const command = options.command || 'magick';

  const allowedFormats = new Set(['jpg', 'jpeg', 'png', 'webp']);

  if (!Number.isInteger(width) || width <= 0 || width > 10000) {
    throw new Error('Width must be a positive integer up to 10000.');
  }

  if (!Number.isInteger(height) || height <= 0 || height > 10000) {
    throw new Error('Height must be a positive integer up to 10000.');
  }

  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    throw new Error('Quality must be an integer between 1 and 100.');
  }

  if (!allowedFormats.has(format)) {
    throw new Error('Unsupported output format.');
  }

  const inputPath = path.resolve(uploadedImagePath);
  const inputStat = await fs.stat(inputPath);

  if (!inputStat.isFile()) {
    throw new Error('Uploaded image path must point to a file.');
  }

  await fs.mkdir(outputDir, { recursive: true });

  const extension = format === 'jpeg' ? 'jpg' : format;
  const outputFileName = `${path.parse(inputPath).name}-${width}x${height}-${crypto.randomUUID()}.${extension}`;
  const outputPath = path.join(outputDir, outputFileName);

  const resizeValue = options.allowUpscale === true ? `${width}x${height}` : `${width}x${height}>`;

  const args = [
    inputPath,
    '-auto-orient',
    '-resize',
    resizeValue,
    '-quality',
    String(quality),
    '-strip',
    outputPath,
  ];

  await runCommand(command, args, {
    timeout: options.timeout,
    maxBuffer: options.maxBuffer,
  });

  return outputPath;
}

module.exports = {
  resizeUploadedImage,
};