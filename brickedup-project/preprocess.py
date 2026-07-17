import os
import zipfile
from PIL import Image

def bootstrap_directories(project_dir, target_parts):
    """
    Check for, and create if missing, the local directory layout.
    """
    training_dir = os.path.join(project_dir, "brickedup-training-set")
    processed_dir = os.path.join(project_dir, "brickedup-processed-set")
    
    os.makedirs(training_dir, exist_ok=True)
    os.makedirs(processed_dir, exist_ok=True)
    
    for part in target_parts:
        os.makedirs(os.path.join(training_dir, part), exist_ok=True)
        os.makedirs(os.path.join(processed_dir, part), exist_ok=True)
        
    return training_dir, processed_dir

def extract_from_zip(zip_path, training_dir, target_parts):
    """
    Extracts files for target parts from zip into brickedup-training-set.
    """
    print(f"Checking for target files in zip: {zip_path}")
    if not os.path.exists(zip_path):
        print(f"WARNING: ZIP file not found at {zip_path}")
        return False
        
    extracted_count = 0
    with zipfile.ZipFile(zip_path, 'r') as z:
        for member in z.namelist():
            # Expected zip structure: 64-small/{part_id}/filename.jpg
            parts = member.split('/')
            if len(parts) >= 3 and parts[0] == "64-small":
                part_id = parts[1]
                filename = parts[2]
                if part_id in target_parts and filename:
                    target_sub_dir = os.path.join(training_dir, part_id)
                    target_file_path = os.path.join(target_sub_dir, filename)
                    
                    # Extract the file data and write to target
                    try:
                        with z.open(member) as source_file:
                            with open(target_file_path, "wb") as target_file:
                                target_file.write(source_file.read())
                        extracted_count += 1
                    except Exception as e:
                        print(f"Failed to extract {member}: {e}")
                        
    print(f"Extracted {extracted_count} raw images into {training_dir}")
    return extracted_count > 0

def check_training_set_empty(training_dir, target_parts):
    """
    Returns True if any of the target training set folders are empty.
    """
    for part in target_parts:
        part_path = os.path.join(training_dir, part)
        files = [f for f in os.listdir(part_path) if os.path.isfile(os.path.join(part_path, f))]
        if not files:
            return True
    return False

def preprocess_images(training_dir, processed_dir, target_parts):
    """
    Process images to grayscale, scale to 64x64, pad symmetrically with white,
    and save as JPEG in the processed directory.
    """
    processed_count = 0
    error_count = 0
    
    # Determine the resampling filter based on PIL version
    try:
        resample_filter = Image.Resampling.LANCZOS
    except AttributeError:
        # Fallback for older Pillow versions
        resample_filter = Image.ANTIALIAS

    for part in target_parts:
        source_part_dir = os.path.join(training_dir, part)
        dest_part_dir = os.path.join(processed_dir, part)
        
        # Support case-insensitive scans for image extensions
        files = [f for f in os.listdir(source_part_dir) 
                 if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
                 
        if not files:
            print(f"No source images found in training folder for class: {part}")
            continue
            
        print(f"Processing {len(files)} images for part category: {part}")
        
        for file in files:
            src_path = os.path.join(source_part_dir, file)
            # Normalised target filename: swap extension to .jpg
            base_name, _ = os.path.splitext(file)
            dest_path = os.path.join(dest_part_dir, f"{base_name}.jpg")
            
            try:
                # 1. Load image
                with Image.open(src_path) as img:
                    # 2. Convert to single-channel Grayscale (L mode)
                    gray_img = img.convert("L")
                    
                    # 3. Scale normalization maintaining aspect ratio
                    # Copy to avoid modifying standard behavior
                    gray_img.thumbnail((64, 64), resample_filter)
                    scaled_w, scaled_h = gray_img.size
                    
                    # 4. Symmetrical padding onto a solid white 64x64 background
                    canvas = Image.new("L", (64, 64), 255)
                    x_offset = (64 - scaled_w) // 2
                    y_offset = (64 - scaled_h) // 2
                    canvas.paste(gray_img, (x_offset, y_offset))
                    
                    # 5. Export to target as JPEG using standard compression
                    canvas.save(dest_path, "JPEG", quality=90)
                    processed_count += 1
            except Exception as e:
                print(f"ERROR: Could not process {file} in {part}: {e}")
                error_count += 1
                
    print(f"Normalization finished: {processed_count} successfully processed, {error_count} errors.")

def main():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    target_parts = ["3001", "3003", "3005", "3023", "3024"]
    zip_path = r"C:\Users\thisi\Downloads\LEGO brick images.zip"
    
    print("Initializing directories...")
    training_dir, processed_dir = bootstrap_directories(project_dir, target_parts)
    
    # Auto-extract if source files are missing/empty
    if check_training_set_empty(training_dir, target_parts):
        print("Training subfolders are empty. Starting automated extraction from zip file...")
        extracted = extract_from_zip(zip_path, training_dir, target_parts)
        if not extracted:
            print("Could not retrieve training images. Preprocessing aborted.")
            return
    else:
        print("Source files already present in training subfolders. Skipping zip extraction.")
        
    print("Starting automated grayscale normalization...")
    preprocess_images(training_dir, processed_dir, target_parts)
    print("Done!")

if __name__ == "__main__":
    main()
