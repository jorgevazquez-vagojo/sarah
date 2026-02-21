#!/bin/bash
# Generate TTS audio for each narration using edge-tts
set -e

VOICE="es-ES-AlvaroNeural"
DIR="$(cd "$(dirname "$0")" && pwd)"

for f in "$DIR"/narration-*.txt; do
  num=$(basename "$f" .txt | sed 's/narration-//')
  outfile="$DIR/audio-${num}.mp3"
  text=$(cat "$f")
  echo "Generating audio-${num}.mp3 ..."
  edge-tts --voice "$VOICE" --text "$text" --write-media "$outfile" 2>/dev/null
done

echo "All audio files generated."
