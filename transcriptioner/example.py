import streamlit as st
from transcriptioner import transcriptioner

st.subheader("Transcriptioner component (prefilled transcription)")

# Create an instance of our component with a prefilled transcription
tscript = transcriptioner("./TEST1.mp3", "./TEST1.txt", height=512)
st.markdown("The current saved transcript is:")
st.markdown(tscript.replace("\n", "\n\n"))

st.subheader("Transcriptioner component (empty transcription)")

# Create an instance of our component with no prefilled
tscript = transcriptioner("./TEST1.mp3", height=512)
st.markdown("The current saved transcript is:")
st.markdown(tscript.replace("\n", "\n\n"))