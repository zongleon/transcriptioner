# a script to move files in/out of the jatos directory
BASE_DIR=$(git rev-parse --show-toplevel)
JATOS_STUDY_DIR=$BASE_DIR/jatos_mac_java/study_assets_root/zulu-transcription
SRC_DIR=$BASE_DIR/src

if [[ "$1" == "out" ]]; then
    echo "Moving files out of the JATOS working directory"
    mv $JATOS_STUDY_DIR/* $SRC_DIR/

    mv $SRC_DIR/dist $JATOS_STUDY_DIR/
    mv $SRC_DIR/endPage.html $JATOS_STUDY_DIR/

elif [[ "$1" == "in" ]]; then
    echo "Moving files into the JATOS working directory"
    mv $SRC_DIR/* $JATOS_STUDY_DIR/
else
    echo "either 'in' or 'out' are supported."
fi