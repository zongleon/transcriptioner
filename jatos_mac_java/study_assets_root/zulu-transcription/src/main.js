import "../styles/style.css";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";
import ProgressBar from "progressbar.js";

// production
const SIGNER_URL = "https://factslab.org/get-signed-url?file=";
// dev
// const BUCKET_URL = "http://localhost:5432/";

// relating to the current transcription
let transcripts = [];
let activeRegion = null;
let looping = false;
let playingRegion = false;

// we'll only allow 1 level of undo/redo, and only for edit and delete
// these also interact with the auto-save
let history = null;
let recall = null;
let saveHandler = null;

// also relating to the current, but will be initialized on load
let wavesurfer;
let bar;
let previousTime;
let id;
let data;
let currentTranscription; // name of transcription

// options
const AUTOSAVEDELAY = 5000;
const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5];
const regions = RegionsPlugin.create();

// elements
const playpause = document.getElementById("playpause");
const save = document.getElementById("save");
const savequit = document.getElementById("savequit");
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
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");

function parseTimestamp(tstamp) {
  return Number(tstamp.slice(1, -1));
}

function disableButton(button) {
  button.disabled = "disabled";
  button.classList.add("text-[#707070]");
}

function enableButton(button) {
  button.disabled = null;
  button.classList.remove("text-[#707070]");
}

function autosave() {
  clearTimeout(saveHandler);

  saveHandler = setTimeout(() => {
    save.innerHTML = "Auto-saved ✅";
    setTimeout(() => {
      save.innerHTML = "Save";
    }, 3000);
    saveTranscription();
  }, AUTOSAVEDELAY);
}

function clearState() {
  history = null;
  recall = null;

  disableButton(undoBtn);
  disableButton(redoBtn);
}

function setHistory(tscript, type) {
  // set the states
  history = {
    type: type,
    tscript: { ...tscript },
  };
  // recall = null;

  // make the undo button clickable and the recall button not
  enableButton(undoBtn);
  disableButton(redoBtn);

  // any actions that set history or recall should also trigger a save action
  autosave();
}

function setRecall(tscript, type) {
  // history = null;
  recall = {
    type: type,
    tscript: { ...tscript },
  };

  disableButton(undoBtn);
  enableButton(redoBtn);

  autosave();
}

function undo() {
  // console.log("undoing " + history.type, history.tscript);
  let re;
  if (history.type == "delete") {
    // undo a delete action
    // re-add the transcript
    re = { ...history.tscript };
    re.id = re.id.startsWith("region") ? re.id : "region-" + re.id;
    regions.addRegion(re);
    let r = regions.getRegions().find((v) => {
      return v.id == re.id;
    });
    r.tscript = re.tscript;
    transcripts.find((v) => {
      return v.id == re.id;
    }).tscript = re.tscript;
    document.getElementById("ts-" + r.id).textContent = re.tscript;
  } else if (history.type == "edit") {
    // undo a edit action
    // change the text to how it was
    for (let ts of transcripts) {
      if (ts.id == history.tscript.id) {
        // set the recall state
        re = { ...ts };

        // update text and transcript
        document.getElementById("ts-" + ts.id).textContent =
          history.tscript.tscript;
        regions
          .getRegions()
          .find((v) => {
            return v.id == ts.id;
          })
          .setOptions(history.tscript);
        ts.start = history.tscript.start;
        ts.end = history.tscript.end;
        ts.tscript = history.tscript.tscript;
        break;
      }
    }
  } else {
    console.error("invalid history type for undo");
  }

  setRecall(re, history.type);
}

function redo() {
  // console.log("redoing " + recall.type, recall.tscript);
  let hi;
  if (recall.type == "delete") {
    // redo a delete action
    // just delete it again
    hi = { ...recall.tscript };
    removeTranscription(recall.tscript.id);
  } else if (recall.type == "edit") {
    // redo a edit action
    // same as undo, just change the text
    for (let ts of transcripts) {
      if (ts.id == recall.tscript.id) {
        // set history state
        hi = { ...ts };

        // actual recall action
        document.getElementById("ts-" + ts.id).textContent =
          recall.tscript.tscript;
        regions
          .getRegions()
          .find((v) => {
            return v.id == ts.id;
          })
          .setOptions(recall.tscript);
        ts.start = recall.tscript.start;
        ts.end = recall.tscript.end;
        ts.tscript = recall.tscript.tscript;
        break;
      }
    }
  } else {
    console.error("invalid history type for redo");
  }

  setHistory(hi, recall.type);
}

function verifyRegionBounds(id, start, end) {
  for (let checkReg of transcripts) {
    if (checkReg.id == id) {
      continue;
    }
    if (checkReg.start <= start && start <= checkReg.end) {
      return false;
    }
    if (checkReg.start <= end && end <= checkReg.end) {
      return false;
    }
  }
  return true;
}

function createTranscriptionLine(tscript) {
  let transcriptionElement = document.createElement("p");
  transcriptionElement.id = "ts-" + tscript.id;
  transcriptionElement.className = "mt-2";
  transcriptionElement.innerHTML = tscript.tscript;

  transcriptionElement.onblur = () => {
    if (transcriptionElement.textContent == "") {
      transcriptionElement.textContent = "[TRANSCRIBE HERE]";
    }
    // transcriptionElement.removeAttribute("contenteditable");
    let prevTs = transcripts.find((value) => {
      return value.id == tscript.id;
    });

    // only update the transcript if something changed
    if (transcriptionElement.textContent != prevTs.tscript) {
      setHistory(prevTs, "edit");
      prevTs.tscript = transcriptionElement.textContent;
    }
  };

  transcriptionElement.onmouseenter = () => {
    transcriptionElement.setAttribute("contenteditable", "true");
  };

  transcriptionElement.onmousedown = () => {
    transcriptionElement.focus();

    // remove the placeholder text if there
    if (transcriptionElement.textContent == "[TRANSCRIBE HERE]") {
      transcriptionElement.textContent = "";
    }
  };

  transcriptionElement.onclick = () => {
    let tsregion = regions.getRegions().find((v) => {
      return v.id == tscript.id;
    });

    // only have do something if the region is not already highlighted
    if (tsregion.id == activeRegion) {
      return;
    }

    // mark this region
    markTranscriptionLine(tsregion);

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
      tstrans.classList.remove("text-[#bd8a06]");
      // tstrans.classList.add("text-[#7289da]");
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

    tstrans.classList.remove("text-[#bd8a06]", "text-[#7289da]");
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
      tstrans.classList.add("text-[#bd8a06]");
      tsregion.setOptions({
        color: "rgba(251, 191, 36, 0.3)",
      });
    } else if (tsregion.end < region.start) {
      // other trancsript ends before our transcript starts
      // then set the color to grayed out
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

  // Get the position of the target element relative to the scrollable container
  let containerRect = transcription.getBoundingClientRect();
  let elementRect = ele.getBoundingClientRect();

  // Calculate the desired scroll position
  let scrollTop = elementRect.top - containerRect.top + transcription.scrollTop;

  // Ensure the element is at least partially visible
  if (
    scrollTop + elementRect.height >
    transcription.scrollTop + transcription.clientHeight
  ) {
    scrollTop = scrollTop - transcription.clientHeight + elementRect.height;
  }

  transcription.scrollTop = scrollTop;
}

function removeTranscription(id) {
  // remove dom node
  let ele = document.getElementById("ts-" + id);
  ele.remove();

  // remove from tscripts list
  let index = transcripts.findIndex((value) => {
    return value.id == id;
  });

  // don't remove if it can't be
  if (index === -1) {
    return;
  }

  // set the history before we remove
  setHistory(transcripts[index], "delete");

  transcripts.splice(index, 1);

  // remove region
  setTimeout(() => {
    regions
      .getRegions()
      .find((value) => {
        return value.id == id;
      })
      .remove();
  }, 50);
}

function saveTranscription() {
  sortTranscriptions();
  let regs = regions.getRegions();
  let totalMark = 0;
  let totalChar = 0;
  let end = Date.now();
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

    // stats
    totalChar += tscript.tscript.length;
    totalMark += reg.end - reg.start;
  }
  // print end
  outstr += `[${wavesurfer.getDuration().toFixed(3)}]\n`;

  if (jatos !== undefined) {
    jatos.batchSession
      .set(currentTranscription.replace("/", "\\"), {
        transcription: outstr,
        status: completed.checked ? "COMPLETED" : "IN_PROGRESS",
      })
      .then(() => console.log("Batch Session was successfully updated"))
      .catch(() => console.log("Batch Session synchronization failed"));
    jatos.appendResultData({ 
      id: id,
      transcription: currentTranscription,
      start: previousTime,
      end: end,
      totalMark: totalMark,
      totalChar: totalChar,
    });
  }
  previousTime = end;
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

  // console.log("playing region " + activeRegion + " from time " + region.start);

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
    plugins: [regions, TimelinePlugin.create()],
    minPxPerSec: 100,
    dragToSeek: true,
  });

  // progress bar
  wavesurfer.on("load", (url) => {
    bar = new ProgressBar.Line("#waveform", {
      strokeWidth: 4,
      easing: "easeInOut",
      duration: 100,
      color: "#7289da",
      trailColor: "#eee",
      trailWidth: 1,
      svgStyle: { width: "100%", height: "50%" },
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
        playregion.innerHTML = "Loop Region";
      } else {
        playregion.innerHTML = "Play Region";
      }
    };

    disableButton(undoBtn);
    disableButton(redoBtn);
    undoBtn.onclick = undo;
    redoBtn.onclick = redo;

    playregion.onclick = playRegion;

    speed.onchange = (e) => {
      const s = Number(e.target.value);
      wavesurfer.setPlaybackRate(s, true);
    };

    document.onkeydown = (e) => {
      if (document.activeElement.tagName == "P") {
        if (e.code == "Enter" || e.code == "Escape") {
          e.preventDefault();
          document.activeElement.blur();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code == "KeyZ") {
        e.preventDefault();
        if (undoBtn.disabled != "disabled") {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.code == "KeyY") {
        e.preventDefault();
        if (redoBtn.disabled != "disabled") {
          redo();
        }
      }
      if (e.code == "Backspace") {
        e.preventDefault();
        removeTranscription(activeRegion);
      }
      if (e.code == "KeyD") {
        console.log(transcripts);
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
        id: String(i),
        tscript: tscripts[i],
      };
      transcription.appendChild(createTranscriptionLine(t));
      transcripts.push(t);
      regions.addRegion(t);
    }

    wavesurfer.setTime(0);
  });

  regions.enableDragSelection({
    color: "rgba(251, 191, 36, 0.3)",
  });

  regions.on("region-in", (region) => {
    setTimeout(() => {
      markTranscriptionLine(region);
      activeRegion = region.id;
    }, 50);
  });

  regions.on("region-out", (region) => {
    if (!playingRegion) {
      // mark the next region
      let nextTs = getNextTranscription(region.end);
      let tsregion = null;
      if (nextTs != null) {
        tsregion = regions.getRegions().find((v) => {
          return v.id == nextTs.id;
        });
      }
      markTranscriptionLine(tsregion, false);
    }

    // handle looping
    if (activeRegion === region.id) {
      if (looping && wavesurfer.isPlaying()) {
        region.play();
      } else if (playingRegion) {
        wavesurfer.pause();
        wavesurfer.setTime(region.end);
        playingRegion = false;
        setPlayPauseIcon(true);
      } else {
        activeRegion = null;
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
        id: String(region.id),
        tscript: "[TRANSCRIBE HERE]",
      };
      region.tscript = t.tscript;
      transcripts.push(t);

      // figure out where to insert the transcription line
      let nextTs = getNextTranscription(t.start);
      if (nextTs == null) {
        transcription.appendChild(createTranscriptionLine(t));
      } else {
        let prevTs = document.getElementById("ts-" + nextTs.id);
        transcription.insertBefore(createTranscriptionLine(t), prevTs);
      }
      // verify the region does not overlap
      if (!verifyRegionBounds(region.id, region.start, region.end)) {
        alert("Please ensure your region does NOT overlap any other regions.");
        removeTranscription(region.id);
        return;
      }
    }
    wavesurfer.setTime(region.start);
  });

  regions.on("region-updated", (region) => {
    let update = transcripts.find((v) => {
      return v.id == region.id;
    });
    if (!verifyRegionBounds(region.id, region.start, region.end)) {
      alert("Please ensure your region does NOT overlap any other regions.");
      region.setOptions({
        start: update.start,
        end: update.end,
      });
      return;
    }
    setHistory(update, "edit");
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

savequit.onclick = () => {
  savequit.innerHTML = "Saved ✅";
  saveTranscription();
  jatos.startComponentByPos(1);
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

function getPresignedUrl(file) {
  return fetch(SIGNER_URL + encodeURIComponent(file))
    .then(response => {
      if (!response.ok) {
        throw new Error("Failed to get presigned URL for " + file);
      }
      return response.json();
    })
    .then(data => {
      if (!data.signedUrl) {
        throw new Error("Missing signedUrl in response for " + file);
      }
      return data.signedUrl;
    });
}

jatos.onLoad(() => {
  if (jatos.studySessionData === undefined || jatos.studySessionData == null) {
    jatos.endStudy("NO SESSION DATA");
  }

  // from previous component
  id = jatos.studySessionData.id;
  currentTranscription = jatos.studySessionData.transcription;

  // preload checkbox
  completed.checked = jatos.studySessionData.status == "COMPLETED";

  // get data like {current: str, status: str}
  data = jatos.batchSession.get(currentTranscription);
  console.log(data);

  if (data !== undefined) {
    // If transcription data exists, get the presigned URL for the audio file.
    getPresignedUrl(currentTranscription)
      .then(audioUrl => {
        initializeWavesurfer(audioUrl, data.transcription);
      })
      .catch(error => {
        alert("Error: " + error.message);
      });
  } else {
    // If no transcription data, fetch the transcription text first.
    let starterText = currentTranscription.split(".")[0] + ".txt";
    getPresignedUrl(starterText)
      .then(textUrl => fetch(textUrl))
      .then(response => {
        if (!response.ok) {
          throw new Error("Failed to fetch the transcription text");
        }
        return response.text();
      })
      .then(text => {
        // After obtaining the text, get the presigned URL for the audio file.
        return getPresignedUrl(currentTranscription)
          .then(audioUrl => {
            initializeWavesurfer(audioUrl, text);
          });
      })
      .catch(error => {
        alert("Error: " + error.message);
      });
  }

  // keep start time to upload total time transcriptioning as result
  previousTime = Date.now();
});
