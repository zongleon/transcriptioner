import streamlit as st
from transcriptioner import transcriptioner

# Add some test code to play with the component while it's in development.
# During development, we can run this just as we would any other Streamlit
# app: `$ streamlit run my_component/example.py`

st.subheader("Transcriptioner component")

# Create an instance of our component
tscript = transcriptioner(audio_path="https://leonzong.com/TEST1.mp3", text_path="https://leonzong.com/TEST1.txt")
st.markdown("The current transcript is:")
st.markdown(tscript)