import "../styles/style.css";

const aliasDisplay = document.getElementById("alias-display");
const aliasWelcome = document.getElementById("alias-welcome");
const aliasInput = document.getElementById("alias-input");
const aliasPrompt = document.getElementById("alias-prompt");
const aliasTextBox = document.getElementById("alias-text-box");
const aliasSubmit = document.getElementById("alias-submit");

const list = document.getElementById("item-list");
const templ = document.getElementById("item-templ");

let id;
let alias;

if (jatos !== undefined) {
  jatos.onLoad(() => {
    // get participant id from query params
    if (jatos.urlQueryParameters.id === undefined) {
      jatos.endStudy();
    }
    id = jatos.urlQueryParameters.id;

    // check alias from batch session
    alias = jatos.batchSession.get(id);

    // handle alias recording
    if (alias === undefined && jatos.studySessionData.id === undefined) {
      showMakeAlias(id);
    } else if (jatos.studySessionData.id !== undefined) {
      showAliasWelcome(jatos.studySessionData.id, jatos.studySessionData.alias);
    } else {
      showAliasWelcome(id, alias);
    }
  });
}

function showMakeAlias(id) {
  // hide the alias display
  aliasDisplay.classList.add("hidden");

  aliasPrompt.innerHTML = `Hello, transcriber ${id}! Please enter your name or other alias.`;

  aliasSubmit.onclick = (event) => {
    updateAlias(id, aliasTextBox.value);
    showAliasWelcome(id, aliasTextBox.value);
  };
}

function showAliasWelcome(id, alias) {
  // hide the input display
  aliasInput.classList.add("hidden");
  aliasDisplay.classList.remove("hidden");

  aliasWelcome.innerHTML = `Welcome, transcriber ${id} (${alias})! Choose any item to get started.`;

  showItemList();
}

function updateAlias(id, alias) {
  if (jatos === undefined) {
    return;
  }
  jatos.batchSession.set(id, alias);
}

function addItem(idx, name, status) {
  console.log("adding ", idx, name, status);
  let newItem = templ.cloneNode(true);

  newItem.id = "item-" + idx;
  newItem.transcript = name;
  newItem.classList.remove("hidden");

  const itemName = newItem.querySelector(".item-name");
  const itemStatus = newItem.querySelector(".item-status");

  itemName.innerHTML = name;
  itemStatus.innerHTML = status;

  switch (status) {
    case "COMPLETED":
      itemStatus.classList.add("text-emerald-400");
      break;
    case "IN_PROGRESS":
      itemStatus.classList.add("text-amber-300");
      break;
    default:
      itemStatus.classList.add("text-rose-600");
  }
 
  newItem.onclick = (e) => {
    if (jatos === undefined) {
        return;
    }
    jatos.studySessionData = {
        id: id,
        alias: alias,
        transcription: name,
    }
    jatos.startNextComponent();
  };

  list.appendChild(newItem);
}

function showItemList() {
  if (jatos === undefined) {
    return;
  }

  const items = jatos.studyJsonInput;

  let itemIdx = 0;
  for (const i of items) {
    let item = jatos.batchSession.get(i.replace("/", "\\"));
    let status = "NOT_STARTED";
    if (item !== undefined) {
      status = item.status;
    }
    addItem(itemIdx, i, status);
    itemIdx++;
  }
}
