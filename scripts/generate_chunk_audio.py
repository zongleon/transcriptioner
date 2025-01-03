import os
from pydub import AudioSegment, effects

# Function to chunk audio into 5-minute segments and convert to .wav
def chunk_audio(file_path, output_dir, chunk_length_ms=5*60*1000):
    audio = AudioSegment.from_file(file_path)
    audio = effects.normalize(audio)
    audio = audio.set_channels(1)
    duration_ms = len(audio)
    
    # Convert to .wav and chunk if necessary
    filename = os.path.splitext(os.path.basename(file_path))[0]
    
    if duration_ms > chunk_length_ms:
        for i in range(0, duration_ms, chunk_length_ms):
            chunk = audio[i:i+chunk_length_ms]
            chunk_name = f"{filename}_chunk{i//chunk_length_ms + 1}.wav"
            chunk.export(os.path.join(output_dir, chunk_name), format="wav")
            print(f"Exported: {chunk_name}")
    else:
        # If the audio is less than or equal to 5 minutes, just convert it to .wav
        output_path = os.path.join(output_dir, f"{filename}.wav")
        audio.export(output_path, format="wav")
        print(f"Converted without splitting: {output_path}")

# Function to walk through directories and process audio files
def process_audio_directory(input_dir, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    for root, dirs, files in os.walk(input_dir):
        # Create output subdirectories to maintain folder structure
        relative_path = os.path.relpath(root, input_dir)
        output_subdir = os.path.join(output_dir, relative_path)
        
        if not os.path.exists(output_subdir):
            os.makedirs(output_subdir)
        
        for file in files:
            if file.endswith(('.mp3', '.mp4', '.m4a')):
                file_path = os.path.join(root, file)
                chunk_audio(file_path, output_subdir)

# Example usage
input_directory = '../data/'
output_directory = '../processed/'

process_audio_directory(input_directory, output_directory)