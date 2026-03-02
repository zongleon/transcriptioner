import os
import shutil
import sys

# Define directories
text_dir = sys.argv[1]
audio_dir = sys.argv[2]
matched_dir = sys.argv[3]

# Create matched directory if it doesn't exist
os.makedirs(matched_dir, exist_ok=True)

# Loop through text files
for filename in os.listdir(text_dir):
    if filename.endswith('.txt'):
        # Extract the 32-bit hash (everything before the first timestamp separator)
        hash_part = filename.split('.')[0][:32]
        audio_filename = f"{hash_part}.wav"
        audio_path = os.path.join(audio_dir, audio_filename)

        # Check if corresponding audio file exists
        if os.path.exists(audio_path):
            # Full paths
            text_path = os.path.join(text_dir, filename)
            matched_text_path = os.path.join(matched_dir, f"{hash_part}.txt")
            matched_audio_path = os.path.join(matched_dir, audio_filename)

            # Copy both files to matched/
            shutil.copy2(text_path, matched_text_path)
            shutil.copy2(audio_path, matched_audio_path)

