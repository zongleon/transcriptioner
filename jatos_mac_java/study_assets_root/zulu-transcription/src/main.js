import "../styles/style.css";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import ProgressBar from "progressbar.js";

const BUCKET_URL = "https://cdn.leonzong.com/";

let transcripts = [];
let activeRegion = 0;
let looping = false;
let playingRegion = false;

const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5];

const playpause = document.getElementById("playpause");
const save = document.getElementById("save");
const transcription = document.getElementById("transcription");
const zoom = document.getElementById("zoom");
const back = document.getElementById("back-10s");
const fwd = document.getElementById("fwd-10s");
const seekstart = document.getElementById("seekstart");
const seekend = document.getElementById("seekend");
const playregion = document.getElementById("play-region");
const loop = document.getElementById("loop");
const speed = document.getElementById("speed");
const completed = document.getElementById("completed");

const regions = RegionsPlugin.create();

let wavesurfer;
let bar;
let startTime;
let id;
let data;
let currentTranscription;

function parseTimestamp(tstamp) {
  return Number(tstamp.slice(1, -1));
}

function createTranscriptionLine(tscript) {
  let transcriptionElement = document.createElement("p");
  transcriptionElement.id = "ts-" + tscript.id;
  transcriptionElement.className = "mt-2";
  transcriptionElement.innerHTML = tscript.tscript;
  transcriptionElement.ondblclick = () => {
    transcriptionElement.setAttribute("contenteditable", "true");
    transcriptionElement.focus();
    transcriptionElement.classList.add("text-[#fbbf24]");
  };

  transcriptionElement.onblur = () => {
    transcriptionElement.removeAttribute("contenteditable");
    transcripts.find((value) => {
      return value.id == tscript.id;
    }).tscript = transcriptionElement.textContent;
  };

  transcriptionElement.onclick = () => {
    // mark this region
    markTranscriptionLine(
      regions.getRegions().find((v) => {
        return v.id == tscript.id;
      })
    );

    // seek to it as well
    wavesurfer.setTime(tscript.start);
  };

  return transcriptionElement;
}

function markTranscriptionLine(region, markCurrent = true) {
  if (region === undefined || region == null) {
    // clear styles
    for (const tscript of transcripts) {
      // get matching transcription line
      let tstrans = document.getElementById("ts-" + tscript.id);
      if (tstrans == null) {
        console.log(
          `invalid tscript in transcripts list: id ${tscript.id}, skipping`
        );
        continue;
      }

      // get matching transcription region
      let tsregion = regions.getRegions().find((v) => {
        return v.id == tscript.id;
      });

      // gray it all out
      tstrans.classList.remove("text-[#fbbf24]");
      tstrans.classList.add("text-[#7289da]");
      tsregion.setOptions({
        color: "rgba(114, 137, 218, 0.3)",
      });
    }
    return;
  }

  // loop through all transcripts
  for (const tscript of transcripts) {
    // get matching transcription line
    let tstrans = document.getElementById("ts-" + tscript.id);
    if (tstrans == null) {
      console.log(
        `invalid tscript in transcripts list: id ${tscript.id}, skipping`
      );
      continue;
    }

    // get matching transcription region
    let tsregion = regions.getRegions().find((v) => {
      return v.id == tscript.id;
    });

    tstrans.classList.remove("text-[#fbbf24]", "text-[#7289da]");
    // process transcription styles
    if (
      tsregion.start > region.end ||
      (tsregion.start == region.start && !markCurrent)
    ) {
      // other transcript starts after our transcript ends
      // then set the color to nothing
      tsregion.setOptions({
        color: "rgba(0, 0, 0, 0.2)",
      });
    } else if (tsregion.start == region.start && markCurrent) {
      // this transcript should be marked as gold
      scrollTranscriptions(tsregion.id);
      tstrans.classList.add("text-[#fbbf24]");
      tsregion.setOptions({
        color: "rgba(251, 191, 36, 0.3)",
      });
    } else if (tsregion.end < region.start) {
      // other trancsript ends before our transcript starts
      // then set the color to grayed out
      tstrans.classList.add("text-[#7289da]");
      tsregion.setOptions({
        color: "rgba(114, 137, 218, 0.3)",
      });
    } else {
      console.error(
        `something wrong happened with transcripts ${tscript.id}, ${region.id}`
      );
    }
  }
}

function getNextTranscription(tstamp) {
  for (let tscript of transcripts) {
    if (
      tscript.start - tstamp > 0 ||
      (tscript.start < tstamp && tstamp < tscript.end)
    ) {
      return tscript;
    }
  }
  return null;
}

function sortTranscriptions() {
  transcripts.sort((a, b) => {
    return a.start - b.start;
  });
}

function scrollTranscriptions(toId) {
  sortTranscriptions();
  let tspos = transcripts.findIndex((value) => {
    return value.id == toId;
  });
  let scrollid = tspos >= 3 ? tspos - 3 : 0;
  let ele = document.getElementById("ts-" + transcripts[scrollid].id);
  let pos = ele.offsetTop - 216;
  transcription.scrollTop = pos;
}

function removeTranscription(id) {
  // remove dom node
  let ele = document.getElementById("ts-" + id);
  ele.remove();

  // remove from tscripts list
  let index = transcripts.findIndex((value) => {
    return value.id == id;
  });
  if (index !== -1) {
    transcripts.splice(index, 1);
  }

  // remove region
  regions
    .getRegions()
    .find((value) => {
      return value.id == id;
    })
    .remove();
}

function saveTranscription() {
  sortTranscriptions();
  let regs = regions.getRegions();
  // print header
  let outstr = "[0.000]\n<no-speech>\n";
  for (let tscript of transcripts) {
    let reg = regs.find((value) => {
      return value.id == tscript.id;
    });
    // print body
    outstr += `[${reg.start.toFixed(3)}]\n`;
    outstr += `${tscript.tscript}\n`;
    outstr += `[${reg.end.toFixed(3)}]\n`;
    outstr += `<no-speech>\n`;
  }
  // print end
  outstr += `[${wavesurfer.getDuration().toFixed(3)}]\n`;
  // save file
  const blob = new Blob([outstr], { type: "text/plain" });

  let filename =
    currentTranscription.split("/")[1].replace(".mp3", "").replace(/\s/g, "") +
    Date.now().toString() +
    ".txt";
  if (jatos !== undefined) {
    jatos.uploadResultFile(blob, filename);
    jatos.batchSession
      .set(currentTranscription.replace("/", "\\"), {
        transcription: outstr,
        status: completed.checked ? "COMPLETED" : "IN_PROGRESS",
      })
      .then(() => console.log("Batch Session was successfully updated"))
      .catch(() => console.log("Batch Session synchronization failed"));
    jatos.submitResultData({ start: startTime, finish: Date.now(), id: id });
  }
}

function setPlayPauseIcon(showPlay) {
  for (const node of playpause.children) {
    if (node.classList.contains("play") && showPlay) {
      node.classList.remove("hidden");
    } else if (node.classList.contains("play") && !showPlay) {
      node.classList.add("hidden");
    } else if (node.classList.contains("pause") && showPlay) {
      node.classList.add("hidden");
    } else {
      node.classList.remove("hidden");
    }
  }
}

function togglePlay() {
  wavesurfer.playPause();
  setPlayPauseIcon(!wavesurfer.isPlaying());
  playingRegion = false;
}

function playRegion() {
  if (activeRegion == null) {
    return;
  }
  // remove from tscripts list
  let region = transcripts.find((value) => {
    return value.id == activeRegion;
  });

  console.log("playing region " + activeRegion + " from time " + region.start);
  
  wavesurfer.setTime(region.start + 0.001);
  wavesurfer.play();
  setPlayPauseIcon(false);
  playingRegion = true;
}

function initializeWavesurfer(audio, text) {
  wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: "rgb(156 163 175)",
    progressColor: "#7289da",
    url: audio,
    plugins: [regions],
    minPxPerSec: 100,
    dragToSeek: true,
  });

  // progress bar
  wavesurfer.on("load", (url) => {
    bar = new ProgressBar.Line("#waveform", {
      strokeWidth: 4,
      easing: "easeInOut",
      duration: 100,
      color: "#FFEA82",
      trailColor: "#eee",
      trailWidth: 1,
      svgStyle: { width: "20%", height: "20%" },
      from: { color: "#FFEA82" },
      to: { color: "#ED6A5A" },
      step: (state, bar) => {
        bar.setText(Math.round(bar.value() * 100) + " %");
      },
    });
  });

  // animate pbar
  wavesurfer.on("loading", (percent) => {
    bar.animate(percent / 100);
  });

  wavesurfer.once("decode", () => {
    bar.destroy();
    playpause.onclick = () => {
      togglePlay();
    };

    zoom.oninput = (e) => {
      const minPxPerSec = e.target.valueAsNumber;
      wavesurfer.zoom(minPxPerSec);
    };

    fwd.onclick = () => {
      wavesurfer.skip(5);
    };

    back.onclick = () => {
      wavesurfer.skip(-5);
    };

    seekstart.onclick = () => {
      wavesurfer.setTime(0);
    };

    seekend.onclick = () => {
      wavesurfer.setTime(wavesurfer.getDuration());
    };

    loop.onclick = () => {
      loop.classList.toggle("text-[#fbbf24]");
      looping = !looping;
      if (looping) {

      }
    };

    playregion.onclick = playRegion;

    speed.onchange = (e) => {
      const s = Number(e.target.value);
      wavesurfer.setPlaybackRate(s, true);
    };

    document.onkeydown = (e) => {
      if (document.activeElement.tagName == "P") {
        return;
      }
      if (e.code == "Backspace") {
        e.preventDefault();
        removeTranscription(activeRegion);
      }
      if (e.code == "Space" && document.activeElement !== playpause) {
        e.preventDefault();
        togglePlay();
      }
    };

    const tscripts = text.split("\n");
    const numTscripts = tscripts.length;

    for (let i = 1; i < numTscripts - 1; i += 2) {
      if (tscripts[i] == "<no-speech>") {
        continue;
      }
      let t = {
        start: parseTimestamp(tscripts[i - 1]),
        end: parseTimestamp(tscripts[i + 1]),
        color: "rgba(0, 0, 0, 0.2)",
        id: i,
        tscript: tscripts[i],
      };
      transcription.appendChild(createTranscriptionLine(t));
      transcripts.push(t);
      regions.addRegion(t);
    }
  });

  regions.enableDragSelection({
    color: "rgba(251, 191, 36, 0.3)",
  });

  regions.on("region-in", (region) => {
    setTimeout(() => {
      markTranscriptionLine(region);
    }, 50);
    activeRegion = region.id;
  });

  regions.on("region-out", (region) => {
    // mark the next region
    let nextTs = getNextTranscription(region.end);
    let tsregion = null;
    if (nextTs != null) {
      tsregion = regions.getRegions().find((v) => {
        return v.id == nextTs.id;
      });
    }
    markTranscriptionLine(tsregion, false);

    // handle looping
    if (activeRegion === region.id) {
      if (looping && wavesurfer.isPlaying()) {
        region.play();
      } else {
        if (playingRegion) {
          wavesurfer.pause();
          setPlayPauseIcon(true);
        } else {
          activeRegion = null;
        }
      }
    }
  });

  regions.on("region-clicked", (region, e) => {
    activeRegion = region.id;
  });

  regions.on("region-created", (region) => {
    if (region.id.toString().startsWith("region")) {
      let t = {
        start: region.start,
        end: region.end,
        color: "rgba(251, 191, 36, 0.3)",
        id: region.id,
        tscript: "[TRANSCRIBE HERE]",
      };
      region.tscript = t.tscript;
      let nextTs = getNextTranscription(t.start);
      if (nextTs == null) {
        transcription.appendChild(createTranscriptionLine(t));
      } else {
        let prevTs = document.getElementById("ts-" + nextTs.id);
        transcription.insertBefore(createTranscriptionLine(t), prevTs);
      }

      transcripts.push(t);
    }
    wavesurfer.setTime(region.start);
  });

  regions.on("region-updated", (region) => {
    let update = transcripts.find((v) => {
      return v.id == region.id;
    });
    update.start = region.start;
    update.end = region.end;
  });

  wavesurfer.on("interaction", (time) => {
    let nextTs = getNextTranscription(time);
    let tsregion = null;
    if (nextTs != null) {
      tsregion = regions.getRegions().find((v) => {
        return v.id == nextTs.id;
      });
    }
    for (let tscript of transcripts) {
      if (time > tscript.start && time < tscript.end) {
        return;
      }
    }
    activeRegion = null;
    markTranscriptionLine(tsregion, false);
  });
}

save.onclick = () => {
  save.innerHTML = "Saved ✅";
  setTimeout(() => {
    save.innerHTML = "Save";
  }, 3000);
  saveTranscription();
};

speeds.forEach((s) => {
  const option = document.createElement("option");
  option.value = s;
  option.textContent = `${s}x`;

  // Optionally set the default selected value
  if (s === 1) {
    option.selected = true;
  }

  speed.appendChild(option);
});

jatos.onLoad(() => {
  jatos.addAbortButton({
    text: "Return to menu",
    confirm: false,
    tooltip: "Saves the current transcription and returns to menu",
    msg: "User returned to menu",
    action: () => {
      saveTranscription();
      jatos.startComponentByPos(1, {
        start: startTime,
        finish: Date.now(),
        id: id,
      });
    },
  });

  if (jatos.studySessionData === undefined || jatos.studySessionData == null) {
    jatos.endStudy("NO SESSION DATA");
  }

  // from previous component
  id = jatos.studySessionData.id;
  currentTranscription = jatos.studySessionData.transcription;

  // get data like {current: str, status: str}
  data = jatos.batchSession.get(currentTranscription.replace("/", "\\"));

  if (data !== undefined) {
    initializeWavesurfer("./dist/" + currentTranscription, data.transcription);
  } else {
    initializeWavesurfer("./dist/" + currentTranscription, "");
  }

  // keep start time to upload total time transcriptioning as result
  startTime = Date.now();
});
