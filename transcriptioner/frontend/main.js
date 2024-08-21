import "./style.css";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { Streamlit } from "streamlit-component-lib";

let scale = 1;
let transcripts = [];
let deletableRegion = 0;
let wavesurfer;
let initial_transcription;

const playpause = document.getElementById("playpause");
const save = document.getElementById("save");
const transcription = document.getElementById("transcription");

const regions = RegionsPlugin.create();

function onRender(event) {
  const data = event.detail;
  wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: "#FFFFFF",
    progressColor: "#fbbf24",
    url: data.args["audio_path"],
    plugins: [regions],
    dragToSeek: true,
  });
  initial_transcription = data.args["text_path"];

  Streamlit.setFrameHeight();
}

function parseTimestamp(tstamp) {
  return Number(tstamp.slice(1, -1));
}

function createTranscriptionLine(tscript) {
  let transcriptionElement = document.createElement("p");
  transcriptionElement.id = "ts-" + tscript.id;
  transcriptionElement.className = "mt-2 ";
  transcriptionElement.innerHTML = tscript.tscript;
  transcriptionElement.addEventListener("dblclick", () => {
    transcriptionElement.setAttribute("contenteditable", "true");
    transcriptionElement.focus();
  });

  transcriptionElement.addEventListener("blur", () => {
    transcriptionElement.removeAttribute("contenteditable");
    transcripts.find((value) => {
      return value.id == tscript.id;
    }).tscript = transcriptionElement.textContent;
  });

  transcriptionElement.addEventListener("click", () => {
    wavesurfer.setTime(tscript.start);
  });

  return transcriptionElement;
}

function markTranscriptionLine(region, inOut) {
  let ele = document.getElementById("ts-" + region.id);
  if (ele == null) {
    return;
  }
  ele.classList.remove("text-[#fbbf24]", "text-gray-400");
  if (inOut == "in") {
    // set previous transcriptions to out
    for (let tscript of transcripts) {
      if (tscript.start > region.start) {
        markTranscriptionLine(tscript, "pre");
      } else if (tscript.start == region.start) {
        continue;
      } else {
        markTranscriptionLine(tscript, "out");
      }
    }
    scrollTranscriptions(region.id);
    ele.classList.add("text-[#fbbf24]");
  } else if (inOut == "out") {
    ele.classList.add("text-gray-400");
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
    outstr += `[${reg.start.toLocaleString(undefined, {
      minimumFractionDigits: 3,
    })}]\n`;
    outstr += `${tscript.tscript}\n`;
    outstr += `[${reg.end.toLocaleString(undefined, {
      minimumFractionDigits: 3,
    })}]\n`;
    outstr += `<no-speech>\n`;
  }
  // print end
  outstr += `[${wavesurfer.getDuration()}]\n`;
  // save file
  // const blob = new Blob([outstr], { type: 'text/plain' });
  // const link = document.createElement('a');
  // link.href = URL.createObjectURL(blob);
  // link.download = 'transcription.txt';
  // link.click();
  // URL.revokeObjectURL(link.href);
  Streamlit.setComponentValue(outstr);
}

wavesurfer.once("decode", () => {
  playpause.addEventListener("click", () => {
    wavesurfer.playPause();
  });

  document.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName == "P") {
      return;
    }
    if (e.code == "Space" && document.activeElement !== playpause) {
      e.preventDefault();
      wavesurfer.playPause();
    }
  });

  document.addEventListener(
    "wheel",
    (e) => {
      if (e.target.parentElement.id == "waveform") {
        e.preventDefault();
      } else {
        return;
      }
      scale += e.deltaY * -0.01;

      scale = Math.min(Math.max(10, scale), 100);

      wavesurfer.zoom(scale);
    },
    { passive: false }
  );

  if (initial_transcription == null) {
    return;
  }
  fetch(initial_transcription)
    .then((res) => res.text())
    .then((text) => {
      const tscripts = text.split("\n");
      const numTscripts = tscripts.length;

      for (let i = 1; i < numTscripts - 1; i += 2) {
        if (tscripts[i] == "<no-speech>") {
          continue;
        }
        let t = {
          start: parseTimestamp(tscripts[i - 1]),
          end: parseTimestamp(tscripts[i + 1]),
          color: "rgba(0, 50, 100, 0.2)",
          id: i,
          tscript: tscripts[i],
        };
        transcription.appendChild(createTranscriptionLine(t));
        transcripts.push(t);
        regions.addRegion(t);
      }
    })
    .catch((e) => console.error(e));
});

regions.enableDragSelection();

regions.on("region-in", (region) => {
  markTranscriptionLine(region, "in");
  setTimeout(() => {
    deletableRegion = region.id;
  }, 50);
});

regions.on("region-out", (region) => {
  markTranscriptionLine(region, "out");
  deletableRegion = null;
});

regions.on("region-clicked", (region, e) => {
  markTranscriptionLine(region, "in");
});

regions.on("region-created", (region) => {
  if (region.id.toString().startsWith("region")) {
    let t = {
      start: region.start,
      end: region.end,
      color: "rgba(0, 50, 100, 0.2)",
      id: region.id,
      tscript: "[TRANSCRIBE HERE]",
    };
    region.tscript = t.tscript;
    console.log(regions.getRegions());
    let prevTs = document.getElementById(
      "ts-" + getNextTranscription(t.start).id
    );
    transcription.insertBefore(createTranscriptionLine(t), prevTs);
    transcripts.push(t);
  }
});

wavesurfer.on("interaction", (time) => {
  markTranscriptionLine(getNextTranscription(time), "in");
});

save.addEventListener("click", saveTranscription);

document.addEventListener("keydown", (e) => {
  if (document.activeElement.tagName == "P") {
    return;
  }
  if (e.code == "Backspace") {
    e.preventDefault();
    removeTranscription(deletableRegion);
  }
});

// Attach our `onRender` handler to Streamlit's render event.
Streamlit.events.addEventListener(Streamlit.RENDER_EVENT, onRender);

// Tell Streamlit we're ready to start receiving data. We won't get our
// first RENDER_EVENT until we call this function.
Streamlit.setComponentReady();

// Finally, tell Streamlit to update our initial height. We omit the
// `height` parameter here to have it default to our scrollHeight.
Streamlit.setFrameHeight();
