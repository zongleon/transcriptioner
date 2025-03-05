# transcriptioner

A simple interactive tool to assist human transcribers.
Using [vite](https://vite.dev/) and [wavesurfer](https://wavesurfer.xyz/) and [JATOS](https://www.jatos.org/).

## repository information

Scripts used for preprocessing audio files (anonymizing, normalizing and chunking, and calculating statistics) are located in `scripts/`. Figures from statistics are in `figs/`.

The tool itself is located in `jatos_mac_java/study_assets_root/zulu-transcription/`. It uses vite, tailwind for styling, and wavesurfer for audio waveform tools.

There are various scripts lying around to help with the JATOS development workflow. For example, `clean_src.sh` moves files in and out of the study assets folder (so our node_modules aren't exported, for instance). 

## getting started

1. Download the appropriate version of JATOS for your platform. Replace the jatos_platform_java folder with the version you downloaded, making sure to keep the study_assets_root from this repository.
2. Start JATOS with `./loader.sh start`
3. If the study doens't show up, create a new study and copy everything from study_assets_root/zulu-transcription into the new study_assets_root folder.
3. When developing, use `npm run jatos` to bundle and preprocess the app in a form appropriate for JATOS.

I will provide a .jzip study archive soon (this will allow you to just import directly into your JATOS instance).

