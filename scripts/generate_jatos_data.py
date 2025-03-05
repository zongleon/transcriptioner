import pandas as pd
import hashlib
import json
import re
import random

random.seed(42)

users_csv = "../data/transcribers.csv"
mapping_csv = "../processed/_file_mapping.csv"
output = "../assigned_files"
batch_data_output = "../batch_data.json"

def generate_hash(user):
    """Create an 8-character hash from the user's name (or other unique string)"""
    return hashlib.md5(user.encode()).hexdigest()[:8]

def extract_base(filename):
    """
    Extracts the base file name from a filename like 'file1_chunk1.wav'.
    For example, returns 'file1' for 'file1_chunk1.wav'.
    """
    m = re.match(r"(.+?)_chunk\d+\.wav", filename)
    return m.group(1) if m else filename

def extract_chunk_number(filename):
    """
    Extracts the chunk number from a filename like 'file1_chunk2.wav'.
    Returns an integer (defaulting to 0 if not found).
    """
    m = re.search(r"_chunk(\d+)\.wav", filename)
    return int(m.group(1)) if m else 0

def main():
    # Read the users CSV. Expected to have a column "user"
    users_df = pd.read_csv(users_csv)
    
    # Generate an 8-character hash for each unique user.
    user_to_hash = {user: generate_hash(user) for user in users_df['Name'].unique()}
    
    # Read the CSV that contains the file mappings
    mapping_df = pd.read_csv(mapping_csv)
    
    # Extract the base file name (e.g. "file1" from "file1_chunk1.wav")
    mapping_df['base_file'] = mapping_df['original_file'].apply(extract_base)
    
    # Also extract the chunk number for each file so we can preserve order.
    mapping_df['chunk_number'] = mapping_df['original_file'].apply(extract_chunk_number)

    # mapping_df = mapping_df[~mapping_df['original_file'].str.contains("English")]
    
    # Group the rows by base_file; each group represents one original file's chunks.
    groups = []
    for _, group in mapping_df.groupby('base_file'):
        # Sort the chunks in order (e.g., chunk1, chunk2, ...)
        group_sorted = group.sort_values('chunk_number')
        groups.append(group_sorted)
    
    # Randomize the order of file groups.
    random.shuffle(groups)
    
    # Get a list of users; assignments will be done round-robin.
    users = list(user_to_hash.keys())
    num_users = len(users)
    
    # Assign each file group to a user.
    assigned_groups = []
    for i, group in enumerate(groups):
        # special english group
        if "English" in group.iloc[0]["base_file"]:
            group = group.copy()
            group['Name'] = "English"
            group['id'] = "English"
            assigned_groups.append(group)
            continue
        # Use round-robin assignment.
        user = users[i % num_users]
        group = group.copy()
        group['Name'] = user
        group['id'] = user_to_hash[user]
        assigned_groups.append(group)
    
    # Combine all the assigned groups into one DataFrame.
    result_df = pd.concat(assigned_groups)
    # Select and order the columns as required.
    result_df = result_df[['Name', 'id', 'original_file', 'new_file']]

    # Write the result to the output CSV.
    result_df.to_csv(output + ".csv", index=False)
    print(f"Output written to {output}.csv")

    # and to JSON
    json_mapping = result_df.groupby('id')['new_file'].apply(list).to_dict()

    json_mapping[0] = ["demo.wav"]

    with open(output + ".json", "w") as json_file:
        json.dump(json_mapping, json_file, indent=4)

    # now make the batch data
    result = {
        row["new_file"]: {"status": "NOT_STARTED", "transcription": ""}
        for _, row in mapping_df.iterrows()
    }

    result[0] = "demo"

    # Output the result to a JSON file.
    with open(batch_data_output, "w") as f:
        json.dump(result, f, indent=4)

if __name__ == '__main__':
    main()