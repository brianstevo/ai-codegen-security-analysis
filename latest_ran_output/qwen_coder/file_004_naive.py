import subprocess

def resize_image(image_path, output_path, size):
    try:
        subprocess.run(['convert', image_path, '-resize', size, output_path], check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error resizing image: {e}")
        return False