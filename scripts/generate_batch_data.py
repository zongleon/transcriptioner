import os
import json

def create_file_dict(base_directory):
    file_dict = {}

    # Iterate through all directories in the base directory
    for dirpath, dirnames, filenames in os.walk(base_directory):
        for filename in filenames:
            # Construct the full filepath (inner directory + filename)
            relative_path = os.path.relpath(os.path.join(dirpath, filename), base_directory)
            file_dict[relative_path] = {
                "status": "NOT_STARTED",
                "transcription": "",
            }
    
    return file_dict

def create_file_list(base_directory):
    file_list = []
    # Iterate through all directories in the base directory
    for dirpath, dirnames, filenames in os.walk(base_directory):
        for filename in filenames:
            # Construct the full filepath (inner directory + filename)
            file_list.append(os.path.relpath(os.path.join(dirpath, filename), base_directory))
            
    return file_list


base_directory = '../processed'
file_dict = create_file_list(base_directory)
print(json.dumps(file_dict))
