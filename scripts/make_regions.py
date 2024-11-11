import collections
import os

import numpy as np
import wave
import librosa
import webrtcvad

"""Code from https://github.com/wiseman/py-webrtcvad/blob/master/example.py"""


def read_wave(path):
    """Reads a .wav file.

    Takes the path, and returns (PCM audio data, sample rate).
    """
    with wave.open(path, "rb") as wf:
        num_channels = wf.getnchannels()
        assert num_channels == 1
        sample_width = wf.getsampwidth()
        assert sample_width == 2
        sample_rate = wf.getframerate()
        if sample_rate == 44100:
            y, sample_rate = librosa.load(
                path, sr=32000
            )  # Downsample 44.1kHz to 32000kHz
            pcm_data = (
                (y * 32767).astype(np.int16).tobytes()
            )  # Convert to PCM and then to bytes
        else:
            pcm_data = wf.readframes(wf.getnframes())
        return pcm_data, sample_rate, wf.getnframes() / float(sample_rate)


class Frame(object):
    """Represents a "frame" of audio data."""

    def __init__(self, bytes, timestamp, duration):
        self.bytes = bytes
        self.timestamp = timestamp
        self.duration = duration


def frame_generator(frame_duration_ms, audio, sample_rate):
    """Generates audio frames from PCM audio data.

    Takes the desired frame duration in milliseconds, the PCM data, and
    the sample rate.

    Yields Frames of the requested duration.
    """
    n = int(sample_rate * (frame_duration_ms / 1000.0) * 2)
    offset = 0
    timestamp = 0.0
    duration = (float(n) / sample_rate) / 2.0
    while offset + n < len(audio):
        yield Frame(audio[offset : offset + n], timestamp, duration)
        timestamp += duration
        offset += n


def vad_collector(
    sample_rate, frame_duration_ms, padding_duration_ms, vad, frames, verbose=False
):
    """Filters out non-voiced audio frames.

    Given a webrtcvad.Vad and a source of audio frames, yields only
    the voiced audio.

    Uses a padded, sliding window algorithm over the audio frames.
    When more than 90% of the frames in the window are voiced (as
    reported by the VAD), the collector triggers and begins yielding
    audio frames. Then the collector waits until 90% of the frames in
    the window are unvoiced to detrigger.

    The window is padded at the front and back to provide a small
    amount of silence or the beginnings/endings of speech around the
    voiced frames.

    Arguments:

    sample_rate - The audio sample rate, in Hz.
    frame_duration_ms - The frame duration in milliseconds.
    padding_duration_ms - The amount to pad the window, in milliseconds.
    vad - An instance of webrtcvad.Vad.
    frames - a source of audio frames (sequence or generator).

    Returns: A generator that yields PCM audio data.
    """
    num_padding_frames = int(padding_duration_ms / frame_duration_ms)
    # We use a deque for our sliding window/ring buffer.
    ring_buffer = collections.deque(maxlen=num_padding_frames)
    # We have two states: TRIGGERED and NOTTRIGGERED. We start in the
    # NOTTRIGGERED state.
    triggered = False

    voiced_frames = []
    for frame in frames:
        is_speech = vad.is_speech(frame.bytes, sample_rate)

        if verbose:
            print("1" if is_speech else "0")
        if not triggered:
            ring_buffer.append((frame, is_speech))
            num_voiced = len([f for f, speech in ring_buffer if speech])
            # If we're NOTTRIGGERED and more than 90% of the frames in
            # the ring buffer are voiced frames, then enter the
            # TRIGGERED state.
            if num_voiced > 0.9 * ring_buffer.maxlen:
                triggered = True
                if verbose:
                    print("+(%s)" % (ring_buffer[0][0].timestamp,))
                # We want to yield all the audio we see from now until
                # we are NOTTRIGGERED, but we have to start with the
                # audio that's already in the ring buffer.
                for f, s in ring_buffer:
                    voiced_frames.append(f)
                ring_buffer.clear()
        else:
            # We're in the TRIGGERED state, so collect the audio data
            # and add it to the ring buffer.
            voiced_frames.append(frame)
            ring_buffer.append((frame, is_speech))
            num_unvoiced = len([f for f, speech in ring_buffer if not speech])
            # If more than 90% of the frames in the ring buffer are
            # unvoiced, then enter NOTTRIGGERED and yield whatever
            # audio we've collected.
            if num_unvoiced > 0.9 * ring_buffer.maxlen:
                if verbose:
                    print("-(%s)" % (frame.timestamp + frame.duration))
                triggered = False
                yield (voiced_frames[0].timestamp, voiced_frames[-1].timestamp)
                ring_buffer.clear()
                voiced_frames = []

    if triggered and verbose:
        print("-(%s)" % (frame.timestamp + frame.duration))
    # If we have any leftover voiced audio when we run out of input,
    # yield it.
    if voiced_frames:
        yield (voiced_frames[0].timestamp, voiced_frames[-1].timestamp)


# region mark a single file
def region_mark(file, output_dir, vad):
    filename = os.path.splitext(os.path.basename(file))[0]
    output_path = os.path.join(output_dir, f"{filename}.txt")

    # setup audio read
    audio, sample_rate, total_len = read_wave(file)
    frames = frame_generator(30, audio, sample_rate)
    frames = list(frames)
    segments = list(vad_collector(sample_rate, 30, 240, vad, frames))
    with open(output_path, "w") as f:
        # write transcripts
        s0, _ = segments[0]
        if f"{s0:.3f}" != "0.000":
            f.write("[0.000]\n")
            f.write("<no-speech>\n")
        for i, (segment_start, segment_end) in enumerate(segments):
            f.write(f"[{segment_start:.3f}]\n")
            f.write("[TRANSCRIBE HERE]\n")
            f.write(f"[{segment_end:.3f}]\n")
            f.write("<no-speech>\n")
        f.write(f"[{total_len:.3f}]\n")


# walk through directories and process audio files
def process_audio_directory(input_dir, output_dir, vad):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for root, dirs, files in os.walk(input_dir):
        # Create output subdirectories to maintain folder structure
        relative_path = os.path.relpath(root, input_dir)
        output_subdir = os.path.join(output_dir, relative_path)

        if not os.path.exists(output_subdir):
            os.makedirs(output_subdir)

        for file in files:
            if file.endswith(".wav"):
                file_path = os.path.join(root, file)
                region_mark(file_path, output_subdir, vad)
                print(f"Marked: {file_path}")


if __name__ == "__main__":

    vad = webrtcvad.Vad(3)

    input_dir = "../processed/"
    output_dir = "../processed/"
    process_audio_directory(input_dir, output_dir, vad)
