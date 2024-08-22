import streamlit as st
from transcriptioner import transcriptioner

# Add some test code to play with the component while it's in development.
# During development, we can run this just as we would any other Streamlit
# app: `$ streamlit run my_component/example.py`

st.subheader("Transcriptioner component")

# Create an instance of our component with a prefilled transcription
tscript = transcriptioner("./TEST1.mp3", "./TEST1.txt", height=512)
st.markdown("The current saved transcript is:")
st.markdown(tscript.replace("\n", "\n\n"))

# Create an instance of our component with no prefilled
tscript = transcriptioner("./TEST1.mp3", height=512)
st.markdown("The current saved transcript is:")
st.markdown(tscript.replace("\n", "\n\n"))