import os
import matplotlib.pyplot as plt
from collections import defaultdict
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
    
    return duration_ms / 1000  # Return duration in seconds

# Function to walk through directories and process audio files
def process_audio_directory(input_dir, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    total_duration = 0  # Total length of all audio files in seconds
    file_lengths = []  # Store lengths for histogram
    file_types = defaultdict(int)  # Count different file types
    
    for root, dirs, files in os.walk(input_dir):
        # Create output subdirectories to maintain folder structure
        relative_path = os.path.relpath(root, input_dir)
        output_subdir = os.path.join(output_dir, relative_path)
        
        if not os.path.exists(output_subdir):
            os.makedirs(output_subdir)
        
        for file in files:
            if file.endswith(('.mp3', '.mp4', '.m4a', '.wav')):  # Include .wav for stats
                file_path = os.path.join(root, file)
                file_extension = os.path.splitext(file)[1].lower()
                file_types[file_extension] += 1
                
                duration = chunk_audio(file_path, output_subdir)
                total_duration += duration
                file_lengths.append(duration)
    
    print(f"Total Audio Duration: {total_duration / 3600:.2f} hours")
    
    # Generate statistics plots
    plot_histogram(file_lengths)
    plot_file_types(file_types)

# Function to plot histogram of audio file lengths
def plot_histogram(file_lengths):
    plt.figure(figsize=(8, 5))
    plt.hist(file_lengths, bins=10, color='skyblue', edgecolor='black')
    plt.xlabel('Audio Length (seconds)')
    plt.ylabel('Frequency')
    plt.title('Histogram of Audio File Lengths')
    plt.grid(True)
    plt.show()

# Function to plot file type distribution
def plot_file_types(file_types):
    plt.figure(figsize=(6, 4))
    plt.bar(file_types.keys(), file_types.values(), color='orange', edgecolor='black')
    plt.xlabel('File Type')
    plt.ylabel('Count')
    plt.title('Distribution of Audio File Types')
    plt.show()

# Example usage
input_directory = '../data/'
output_directory = '../processed/'

process_audio_directory(input_directory, output_directory)
