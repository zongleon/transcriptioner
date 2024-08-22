# transcriptioner

A simple interactive tool to assist human transcribers.
Using [vite](https://vite.dev/) and [wavesurfer](https://wavesurfer.xyz/).
Demo file from BABEL dataset.

Implemented as a [streamlit](https://streamlit.io/) component.

## Use transcriptioner

You may install transcriptioner (along with streamlit) using pip.

```sh
pip install transcriptioner
```

Here is a minimal example:

```python
import streamlit as st
from transcriptioner import transcriptioner


st.subheader("Transcriptioner component (prefilled transcription)")

# A prefilled transcription
tscript = transcriptioner("./TEST1.mp3", "./TEST1.txt", height=512)
st.markdown("The current saved transcript is:")
st.markdown(tscript.replace("\n", "\n\n"))

st.subheader("Transcriptioner component (empty transcription)")

# An empty audiof ile
tscript = transcriptioner("./TEST1.mp3", height=512)
st.markdown("The current saved transcript is:")
st.markdown(tscript.replace("\n", "\n\n"))
```

You can then run this example with:
```sh
streamlit run example.py
```
(if you saved the example as example.py)

## Working on

- [ ] dark mode support