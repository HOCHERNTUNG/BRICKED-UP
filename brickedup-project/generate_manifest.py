import os
import json

# ==============================================================================
# CONFIGURATION: Configure your S3 Bucket name here
# Replace [yourname] with your custom identifier (e.g. brickedup-training-data-john)
# ==============================================================================
BUCKET_NAME = "brickedup-object-detection-training-data-5-pieces-learner-lab"

def get_class_id(part_id):
    """
    Map the Rebrickable part category string to the corresponding integer Class ID.
    - 3005 (Brick 1 x 1) -> Class ID: 0
    - 3003 (Brick 2 x 2) -> Class ID: 1
    - 3001 (Brick 2 x 4) -> Class ID: 2
    - 3024 (Plate 1 x 1) -> Class ID: 3
    - 3023 (Plate 1 x 2) -> Class ID: 4
    """
    mapping = {
        "3005": 0,
        "3003": 1,
        "3001": 2,
        "3024": 3,
        "3023": 4
    }
    return mapping.get(part_id)

def generate_manifest():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    processed_dir = os.path.join(project_dir, "brickedup-processed-set")
    manifest_path = os.path.join(project_dir, "output.manifest")
    
    target_parts = ["3001", "3003", "3005", "3023", "3024"]
    
    if not os.path.exists(processed_dir):
        print(f"ERROR: Processed directory not found at {processed_dir}. Run preprocess.py first.")
        return
        
    manifest_lines = []
    
    # Class mapping dict for output metadata
    class_map = {
        "0": "3005",
        "1": "3003",
        "2": "3001",
        "3": "3024",
        "4": "3023"
    }
    
    print(f"Scanning processed images in {processed_dir}...")
    
    for part_id in target_parts:
        part_path = os.path.join(processed_dir, part_id)
        if not os.path.exists(part_path):
            continue
            
        files = [f for f in os.listdir(part_path) if f.lower().endswith(('.jpg', '.jpeg'))]
        class_id = get_class_id(part_id)
        
        if class_id is None:
            print(f"WARNING: Unknown part class directory: {part_id}")
            continue
            
        for file in files:
            # Build the S3 URI path structure: s3://[BUCKET]/[PART_ID]/file.jpg
            s3_ref = f"s3://{BUCKET_NAME}/{part_id}/{file}"
            
            # Construct the Ground Truth object-detection schema
            line_data = {
                "source-ref": s3_ref,
                "bounding-box": {
                    "image_size": [
                        {
                            "width": 64,
                            "height": 64,
                            "depth": 3
                        }
                    ],
                    "annotations": [
                        {
                            "class_id": class_id,
                            "top": 5,
                            "left": 5,
                            "width": 54,
                            "height": 54
                        }
                    ]
                },
                "bounding-box-metadata": {
                    "objects": [
                        {
                            "confidence": 1
                        }
                    ],
                    "class-map": class_map,
                    "type": "groundtruth/object-detection",
                    "human-annotated": "no",
                    "creation-date": "2026-07-15T12:00:00",
                    "job-name": "automated-bounding-box"
                }
            }
            # Append stringified JSON line
            manifest_lines.append(json.dumps(line_data))
            
    if not manifest_lines:
        print("WARNING: No processed files found. Manifest will be empty.")
    else:
        print(f"Generating manifest file with {len(manifest_lines)} entries...")
        
    with open(manifest_path, "w", encoding="utf-8") as f:
        for line in manifest_lines:
            f.write(line + "\n")
            
    print(f"Successfully compiled manifest file at: {manifest_path}")

if __name__ == "__main__":
    generate_manifest()
