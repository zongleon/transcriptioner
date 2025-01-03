#!/bin/bash

# Loop through all .html files in the current directory
for file in ./dist/src/*.html; do
  # Use sed to replace "../assets" with "./dist/assets/" in each file
  sed -i '' -e 's|\.\./assets|./dist/assets|g' "$file"
done