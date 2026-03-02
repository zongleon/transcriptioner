# walk through directory of .wav files
# and calculate total duration
import glob
import os
import wave

DIRECTORY = "../processed/"
total_duration = 0.0

for filename in glob.glob(os.path.join(DIRECTORY, "*.wav")):
    with wave.open(filename, "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        duration = frames / float(rate)
        total_duration += duration

print(f"Total duration of .wav files in {DIRECTORY}: {total_duration / 60:.2f} minutes")
print(f" {total_duration / 3600:.2f} hours")