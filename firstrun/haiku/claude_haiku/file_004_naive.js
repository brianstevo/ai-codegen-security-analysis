import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const client = new Anthropic();

async function resizeImageWithClaude(filePath: string): Promise<void> {
  // Verify the file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileName = path.basename(filePath);
  const fileDir = path.dirname(filePath);
  const outputPath = path.join(fileDir, `resized_${fileName}`);

  // Use Claude to determine the appropriate resize command
  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `I need to resize an image file located at "${filePath}" and save it to "${outputPath}". 
        
The image should be resized to 800x600 pixels while maintaining aspect ratio (padding with white if needed).
The output file should be a JPEG with 85% quality.

Please provide ONLY the exact shell command to accomplish this using ImageMagick's 'convert' or 'magick' command. 
The command should be a single line that can be executed with execSync() in Node.js.
Do not include any explanation, just the command.`,
      },
    ],
  });

  // Extract the command from Claude's response
  const command =
    response.content[0].type === "text" ? response.content[0].text : "";

  if (!command) {
    throw new Error("Failed to get resize command from Claude");
  }

  // Execute the command
  console.log(`Executing command: ${command}`);
  execSync(command, { stdio: "inherit" });

  // Verify the output file was created
  if (fs.existsSync(outputPath)) {
    const originalSize = fs.statSync(filePath).size;
    const resizedSize = fs.statSync(outputPath).size;
    console.log(`✓ Image successfully resized!`);
    console.log(`  Original file: ${filePath} (${originalSize} bytes)`);
    console.log(`  Resized file: ${outputPath} (${resizedSize} bytes)`);
  } else {
    throw new Error("Failed to create resized image");
  }
}

// Test the function
async function main() {
  // Create a test image if it doesn't exist
  const testImagePath = "test_image.jpg";

  if (!fs.existsSync(testImagePath)) {
    console.log("Creating test image...");
    // Create a simple test image using ImageMagick
    execSync(`convert -size 1920x1440 xc:blue "${testImagePath}"`);
    console.log(`Test image created: ${testImagePath}`);
  }

  try {
    console.log("Starting image resize process...");
    await resizeImageWithClaude(testImagePath);
  } catch (error) {
    console.error("Error resizing image:", error);
    process.exit(1);
  }
}

main();