import os
from PIL import Image

project_dir = os.path.dirname(os.path.abspath(__file__))
processed_dir = os.path.join(project_dir, "brickedup-processed-set")

target_parts = ["3001", "3003", "3005", "3023", "3024"]

print("Verifying processed images:")
all_ok = True
for part in target_parts:
    part_path = os.path.join(processed_dir, part)
    if not os.path.exists(part_path):
        print(f"ERROR: Directory missing: {part_path}")
        all_ok = False
        continue
    files = os.listdir(part_path)
    print(f"Category {part}: found {len(files)} files")
    if len(files) == 0:
        print(f"ERROR: Directory is empty: {part_path}")
        all_ok = False
        continue
    
    # Inspect first file
    sample_file = files[0]
    sample_path = os.path.join(part_path, sample_file)
    try:
        with Image.open(sample_path) as img:
            print(f"  Sample: {sample_file} -> size: {img.size}, mode: {img.mode}, format: {img.format}")
            if img.size != (64, 64):
                print(f"  ERROR: Size is {img.size}, expected (64, 64)")
                all_ok = False
            if img.mode != "L":
                print(f"  ERROR: Mode is {img.mode}, expected L (grayscale)")
                all_ok = False
            if img.format != "JPEG":
                print(f"  ERROR: Format is {img.format}, expected JPEG")
                all_ok = False
    except Exception as e:
        print(f"  ERROR: Failed to open {sample_file}: {e}")
        all_ok = False

if all_ok:
    print("Verification SUCCESS: All processed images conform to requirements.")
else:
    print("Verification FAILED: Some images do not conform.")
