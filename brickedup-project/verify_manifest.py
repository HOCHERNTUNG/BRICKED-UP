import os
import json

project_dir = os.path.dirname(os.path.abspath(__file__))
manifest_path = os.path.join(project_dir, "output.manifest")

print("Verifying output.manifest...")

if not os.path.exists(manifest_path):
    print("ERROR: manifest file does not exist!")
    exit(1)

with open(manifest_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
if len(lines) != 250:
    print(f"ERROR: Expected 250 lines, got {len(lines)}")
    exit(1)

class_map_expected = {
    "0": "3005",
    "1": "3003",
    "2": "3001",
    "3": "3024",
    "4": "3023"
}

all_ok = True
for idx, line in enumerate(lines):
    line = line.strip()
    if not line:
        print(f"ERROR: Line {idx+1} is empty!")
        all_ok = False
        continue
    
    try:
        data = json.loads(line)
    except Exception as e:
        print(f"ERROR: Line {idx+1} is not valid JSON: {e}")
        all_ok = False
        continue
    
    # Check source-ref
    source_ref = data.get("source-ref")
    if not source_ref or not source_ref.startswith("s3://"):
        print(f"ERROR: Line {idx+1} has invalid source-ref: {source_ref}")
        all_ok = False
        continue
    
    # Parse part folder and name from source_ref
    parts = source_ref.replace("s3://", "").split("/")
    if len(parts) < 3:
        print(f"ERROR: Line {idx+1} source-ref does not have expected structure: {source_ref}")
        all_ok = False
        continue
    
    part_id = parts[1]
    filename = parts[2]
    
    # Check bounding box
    bbox_container = data.get("bounding-box")
    if not bbox_container:
        print(f"ERROR: Line {idx+1} is missing bounding-box")
        all_ok = False
        continue
        
    annotations = bbox_container.get("annotations")
    if not annotations or len(annotations) != 1:
        print(f"ERROR: Line {idx+1} annotations is invalid: {annotations}")
        all_ok = False
        continue
        
    ann = annotations[0]
    expected_class_id = {"3005": 0, "3003": 1, "3001": 2, "3024": 3, "3023": 4}.get(part_id)
    if ann.get("class_id") != expected_class_id:
        print(f"ERROR: Line {idx+1} class_id is {ann.get('class_id')}, expected {expected_class_id} for part {part_id}")
        all_ok = False
        
    if ann.get("top") != 5 or ann.get("left") != 5 or ann.get("width") != 54 or ann.get("height") != 54:
        print(f"ERROR: Line {idx+1} bounding box coords invalid: {ann}")
        all_ok = False
        
    img_size = bbox_container.get("image_size")
    if img_size != [{"width": 64, "height": 64, "depth": 3}]:
        print(f"ERROR: Line {idx+1} image_size is invalid: {img_size}")
        all_ok = False
        
    # Check metadata
    metadata = data.get("bounding-box-metadata")
    if not metadata:
        print(f"ERROR: Line {idx+1} is missing bounding-box-metadata")
        all_ok = False
        continue
        
    if metadata.get("class-map") != class_map_expected:
        print(f"ERROR: Line {idx+1} class-map is invalid: {metadata.get('class-map')}")
        all_ok = False
        
    if metadata.get("job-name") != "automated-bounding-box":
        print(f"ERROR: Line {idx+1} job-name is invalid: {metadata.get('job-name')}")
        all_ok = False
        
    if metadata.get("type") != "groundtruth/object-detection":
        print(f"ERROR: Line {idx+1} type is invalid: {metadata.get('type')}")
        all_ok = False
        
    if metadata.get("human-annotated") != "no":
        print(f"ERROR: Line {idx+1} human-annotated is invalid: {metadata.get('human-annotated')}")
        all_ok = False
        
    if metadata.get("objects") != [{"confidence": 1}]:
        print(f"ERROR: Line {idx+1} objects is invalid: {metadata.get('objects')}")
        all_ok = False
        
    if metadata.get("creation-date") != "2026-07-15T12:00:00":
        print(f"ERROR: Line {idx+1} creation-date is invalid: {metadata.get('creation-date')}")
        all_ok = False

if all_ok:
    print("Verification SUCCESS: Manifest format and mapping are fully correct.")
else:
    print("Verification FAILED: Errors found in manifest.")
