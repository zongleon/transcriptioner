import os
import re
from collections import defaultdict

input_dir = "../data/inprogress"
output_dir = "../data/transcripts"


def find_latest_txt_files(input_dir, output_dir):
    # Dictionary to store the latest timestamp for each unique hash
    latest_files = defaultdict(lambda: (None, 0))

    # Regular expression to match the file pattern
    file_pattern = re.compile(r'([a-f0-9]{32})(\d+)\.txt')

    # Walk through the input directory recursively
    for root, _, files in os.walk(input_dir):
        for file in files:
            match = file_pattern.match(file)
            if match:
                file_hash, timestamp = match.groups()
                timestamp = int(timestamp)
                if timestamp > latest_files[file_hash][1]:
                    latest_files[file_hash] = (os.path.join(root, file), timestamp)

    # Ensure the output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Write the latest files to the output directory
    for file_hash, (file_path, _) in latest_files.items():
        if file_path:
            output_path = os.path.join(output_dir, os.path.basename(file_path))
            with open(file_path, 'r') as src, open(output_path, 'w') as dst:
                dst.write(src.read())

find_latest_txt_files(input_dir, output_dir)