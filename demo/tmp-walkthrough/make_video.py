#!/usr/bin/env python3
"""
Combine slide screenshots + audio narrations into an MP4 video.
Each slide is shown for the duration of its audio narration (+ 1s padding).
"""
import json
import os
import subprocess
import tempfile

DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(DIR, "..", "redegal-chatbot-walkthrough.mp4")

def get_audio_duration(path):
    """Get duration of audio file in seconds using ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True
    )
    return float(result.stdout.strip())

def main():
    with open(os.path.join(DIR, "narrations.json"), "r") as f:
        narrations = json.load(f)

    total_slides = len(narrations)
    print(f"Total slides: {total_slides}")

    # First, create individual video segments for each slide
    segments = []
    for item in narrations:
        num = item["num"]
        slide_img = os.path.join(DIR, f"slide-{num}.png")
        audio_file = os.path.join(DIR, f"audio-{num}.mp3")

        if not os.path.exists(slide_img):
            print(f"WARNING: slide-{num}.png not found, skipping")
            continue
        if not os.path.exists(audio_file):
            print(f"WARNING: audio-{num}.mp3 not found, skipping")
            continue

        duration = get_audio_duration(audio_file)
        # Add 1.5s padding after narration
        total_duration = duration + 1.5
        print(f"Slide {num}: audio={duration:.1f}s, total={total_duration:.1f}s")

        segment_file = os.path.join(DIR, f"segment-{num}.mp4")
        segments.append(segment_file)

        # Create video segment: image + audio
        subprocess.run([
            "ffmpeg", "-y",
            "-loop", "1",
            "-i", slide_img,
            "-i", audio_file,
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-vf", "scale=1920:1080",
            "-t", str(total_duration),
            "-shortest",
            segment_file
        ], capture_output=True, check=True)
        print(f"  segment-{num}.mp4 created")

    # Create concat file
    concat_file = os.path.join(DIR, "concat.txt")
    with open(concat_file, "w") as f:
        for seg in segments:
            f.write(f"file '{seg}'\n")

    # Concatenate all segments
    print(f"\nConcatenating {len(segments)} segments...")
    subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_file,
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "medium",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        OUTPUT
    ], capture_output=True, check=True)

    # Get final duration
    final_duration = get_audio_duration(OUTPUT)
    file_size = os.path.getsize(OUTPUT) / (1024 * 1024)
    print(f"\nVideo created: {OUTPUT}")
    print(f"Duration: {final_duration:.1f}s ({final_duration/60:.1f} min)")
    print(f"Size: {file_size:.1f} MB")

    # Clean up segment files
    for seg in segments:
        os.remove(seg)
    os.remove(concat_file)
    print("Cleaned up temporary segment files.")

if __name__ == "__main__":
    main()
