#!/bin/bash

BASE_DIR=$(git rev-parse --show-toplevel)
DEMOFILE=$BASE_DIR/demodata/demo.wav
ASSETS_DIR=$BASE_DIR/jatos_mac_java/study_assets_root/zulu-transcription/dist/assets/

# Loop through all .html files in the current directory
for file in ./dist/src/*.html; do
  # Use sed to replace "../assets" with "./dist/assets/" in each file
  sed -i '' -e 's|\.\./assets|./dist/assets|g' "$file"
done

# and bring in the demodata
cp $DEMOFILE $ASSETS_DIR