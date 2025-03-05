#!/usr/bin/env python3
import os
import hashlib
import csv
import argparse
import shutil

def hash_filename(relative_path):
    """
    Generate an MD5 hash for the given relative path.
    Using the relative path ensures that files with the same name in different subfolders
    generate different hashes.
    """
    hash_object = hashlib.md5(relative_path.encode('utf-8'))
    return hash_object.hexdigest()

def process_directory(base_dir):
    """
    Process all files in the directory tree starting at base_dir.
    Each file is renamed using a hash (with original extension preserved) and moved
    to the base_dir. A mapping is recorded from the original relative path to the new file name.
    """
    mapping = []  # List of tuples (original_relative_path, new_file_name)

    # Walk through the directory tree
    for root, dirs, files in os.walk(base_dir):
        # We want to process files in all directories including base_dir
        for file in files:
            original_path = os.path.join(root, file)
            # Compute relative path from base_dir for uniqueness
            relative_path = os.path.relpath(original_path, base_dir)
            # Create a hash from the relative path
            new_name_hash = hash_filename(relative_path)
            # Preserve file extension, if any
            _, ext = os.path.splitext(file)
            new_file_name = new_name_hash + ext
            destination_path = os.path.join(base_dir, new_file_name)

            # Check for potential collisions. In case the file exists already,
            # append a counter until we find a unique name.
            counter = 1
            candidate_name = new_file_name
            while os.path.exists(destination_path):
                candidate_name = f"{new_name_hash}_{counter}{ext}"
                destination_path = os.path.join(base_dir, candidate_name)
                counter += 1

            # Move the file to the base_dir with the new name
            shutil.move(original_path, destination_path)
            mapping.append((relative_path, candidate_name))

    # Optionally remove empty subdirectories
    for root, dirs, files in os.walk(base_dir, topdown=False):
        if root == base_dir:
            continue
        if not os.listdir(root):
            os.rmdir(root)

    # Write the mapping to a CSV file in the base_dir
    mapping_file = os.path.join(base_dir, "file_mapping.csv")
    with open(mapping_file, mode='w', newline='', encoding='utf-8') as csvfile:
        csv_writer = csv.writer(csvfile)
        csv_writer.writerow(["original_file", "new_file"])
        for orig, new in mapping:
            csv_writer.writerow([orig, new])
    
    print(f"Processing complete. Mapping saved to {mapping_file}")

def main():
    parser = argparse.ArgumentParser(
        description="Restructure a directory by renaming files to their hash values and moving them to the top level."
    )
    parser.add_argument("directory", help="The top-level directory to process.")
    args = parser.parse_args()
    
    base_dir = args.directory
    if not os.path.isdir(base_dir):
        print(f"Error: {base_dir} is not a valid directory.")
        exit(1)
    
    process_directory(base_dir)

if __name__ == "__main__":
    main()
