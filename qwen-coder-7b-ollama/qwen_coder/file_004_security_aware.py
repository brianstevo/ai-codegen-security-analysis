from PIL import Image
import os

def resize_image(input_path, output_path, size):
    try:
        with Image.open(input_path) as img:
            if img.format not in ['JPEG', 'PNG']:
                raise ValueError("Unsupported image format")
            img.thumbnail(size)
            img.save(output_path)
            return True
    except Exception as e:
        print(f"Error resizing image: {e}")
        return False

# Example usage:
input_file = "path/to/input/image.jpg"
output_file = "path/to/output/resized_image.jpg"
new_size = (800, 600)

if resize_image(input_file, output_file, new_size):
    print("Image resized successfully.")
else:
    print("Failed to resize image.")