import os
import streamlit.components.v1 as components

_COMPONENT_NAME = "transcriptioner"

# Create a _RELEASE constant. We'll set this to False while we're developing
# the component, and True when we're ready to package and distribute it.
# (This is, of course, optional - there are innumerable ways to manage your
# release process.)
_RELEASE = True

# Declare a Streamlit component
if not _RELEASE:
    _component_func = components.declare_component(
        _COMPONENT_NAME,
        # Pass `url` here to tell Streamlit that the component will be served
        # by the local dev server that you run via `npm run dev`.
        # (This is useful while your component is in development.)
        url="http://localhost:5173",
    )
else:
    # When we're distributing a production version of the component, we'll
    # replace the `url` param with `path`, and point it to the component's
    # build directory:
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(parent_dir, "frontend/dist")
    _component_func = components.declare_component(name=_COMPONENT_NAME, path=build_dir)


# Create a wrapper function for the component
def transcriptioner(audio_path=None, text_path=None, height=512, key=None):
    """Create a new instance of the transcriptioner component.

    Parameters
    ----------
    audio_path: str
        The path to the audio file to be served.
    text_path: str
        The path to the text file to be served.
    height: int
        Height, in px, of the transcriptioner component.
    key: str or None
        An optional key that uniquely identifies this component. If this is
        None, and the component's arguments are changed, the component will
        be re-mounted in the Streamlit frontend and lose its current state.

    Returns
    -------
    str
        The output transcription. Updated every time the user saves the transcription.

    """
    # Call through to our private component function. Arguments we pass here
    # will be sent to the frontend, where they'll be available in an "args"
    # dictionary.
    #
    # "default" is a special argument that specifies the initial return
    # value of the component before the user has interacted with it.
    component_value = _component_func(audio_path=audio_path, text_path=text_path, height=height, key=key, default="")

    # We could modify the value returned from the component if we wanted.
    # There's no need to do this in our simple example - but it's an option.
    return component_value
