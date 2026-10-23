const { app, core, action } = require("photoshop");
const { computeNames } = require("./rename.js");

const $ = (id) => document.getElementById(id);
let selection = { docId: null, items: [] };
let rows = [];
let lastMessage = "";
let readError = "";

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};
const unit = (v) => (v && typeof v === "object" ? v._value : v);

function addRuleRow() {
  const row = document.createElement("div");
  row.className = "rule";
  const find = document.createElement("sp-textfield");
  find.className = "find";
  find.setAttribute("placeholder", "Find");
  const replace = document.createElement("sp-textfield");
  replace.className = "replace";
  replace.setAttribute("placeholder", "Replace with");
  const remove = document.createElement("sp-action-button");
  remove.setAttribute("quiet", "");
  remove.setAttribute("title", "Remove");
  remove.textContent = "✕";
  remove.addEventListener("click", () => {
    row.remove();
    if (!$("rules").children.length) addRuleRow();
    render();
  });
  find.addEventListener("input", onFormChange);
  replace.addEventListener("input", onFormChange);
  row.appendChild(find);
  row.appendChild(replace);
  row.appendChild(remove);
  $("rules").appendChild(row);
}

function readOptions() {
  return {
    replacements: Array.from(document.querySelectorAll("#rules .rule")).map((row) => ({
      find: row.querySelector(".find").value || "",
      replace: row.querySelector(".replace").value || "",
    })),
    matchCase: $("matchCase").checked,
    useRegex: $("useRegex").checked,
    prefix: $("prefix").value || "",
    suffix: $("suffix").value || "",
    order: $("order").value,
    number: {
      enabled: $("numOn").checked,
      position: $("numPos").value,
      separator: $("numSep").value || "",
      start: toInt($("numStart").value, 1),
      digits: Math.min(6, Math.max(1, toInt($("numDigits").value, 1))),
    },
  };
}

async function readSelection() {
  if (!app.documents.length) return { docId: null, items: [] };
  const doc = app.activeDocument;
  const layers = doc.activeLayers;
  if (!layers.length) return { docId: doc.id, items: [] };

  // The DOM has no "is artboard" flag, so ask for each selected layer's descriptor.
  const descriptors = await action.batchPlay(
    layers.map((layer) => ({
      _obj: "get",
      _target: [{ _ref: "layer", _id: layer.id }, { _ref: "document", _id: doc.id }],
    })),
    {},
  );
  const items = [];
  descriptors.forEach((d, i) => {
    if (!d.artboardEnabled) return;
    const rect = (d.artboard && d.artboard.artboardRect) || layers[i].bounds;
    items.push({
      id: layers[i].id,
      name: layers[i].name,
      stackIndex: d.itemIndex,
      top: unit(rect.top),
      left: unit(rect.left),
      bottom: unit(rect.bottom),
    });
  });
  return { docId: doc.id, items };
}

function setStatus(text, isError = false) {
  $("status").textContent = text;
  $("status").className = isError ? "status error" : "status";
}

function setApplyEnabled(on) {
  if (on) $("apply").removeAttribute("disabled");
  else $("apply").setAttribute("disabled", "");
}

function render() {
  $("numOpts").style.display = $("numOn").checked ? "block" : "none";
  const list = $("preview");
  list.innerHTML = "";
  rows = [];
  setApplyEnabled(false);

  if (readError) {
    setStatus("Could not read the selection: " + readError, true);
    return;
  }
  if (!selection.items.length) {
    setStatus(selection.docId
      ? "Select one or more artboards in the Layers panel."
      : "Open a document with artboards.");
    return;
  }
  try {
    rows = computeNames(selection.items, readOptions());
  } catch (e) {
    setStatus(e.message, true);
    return;
  }

  for (const row of rows) {
    const el = document.createElement("div");
    el.className = "item" + (row.empty ? " empty" : row.duplicate ? " dup" : "") + (row.changed ? "" : " same");
    const old = document.createElement("div");
    old.className = "old";
    old.textContent = row.oldName;
    const next = document.createElement("div");
    next.className = "new";
    next.textContent = row.empty ? "(empty — will be skipped)" : "→ " + row.newName;
    if (row.duplicate && !row.empty) {
      const note = document.createElement("span");
      note.className = "note";
      note.textContent = "same name twice";
      next.appendChild(note);
    }
    el.appendChild(old);
    el.appendChild(next);
    list.appendChild(el);
  }

  const willChange = rows.filter((r) => r.changed && !r.empty).length;
  const count = rows.length;
  const parts = [`${count} artboard${count === 1 ? "" : "s"} selected`, `${willChange} will change`];
  if (rows.some((r) => r.duplicate && !r.empty)) parts.push("duplicate names");
  setStatus(lastMessage ? `${lastMessage} ${parts.join(" · ")}` : parts.join(" · "));
  setApplyEnabled(willChange > 0);
}

let refreshTimer = null;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 150);
}

async function refresh() {
  try {
    selection = await readSelection();
    readError = "";
  } catch (e) {
    selection = { docId: null, items: [] };
    readError = e.message;
  }
  render();
}

async function apply() {
  const todo = rows.filter((r) => r.changed && !r.empty);
  if (!todo.length || !app.documents.length || app.activeDocument.id !== selection.docId) return refresh();
  const docId = selection.docId;
  setApplyEnabled(false);
  try {
    await core.executeAsModal(async (ctx) => {
      // One history step, so a single Undo puts every name back.
      const suspension = await ctx.hostControl.suspendHistory({ documentID: docId, name: "Rename Artboards" });
      let ok = false;
      try {
        await action.batchPlay(
          todo.map((r) => ({
            _obj: "set",
            _target: [{ _ref: "layer", _id: r.id }, { _ref: "document", _id: docId }],
            to: { _obj: "layer", name: r.newName },
          })),
          {},
        );
        ok = true;
      } finally {
        await ctx.hostControl.resumeHistory(suspension, ok);
      }
    }, { commandName: "Rename Artboards" });
    lastMessage = `Renamed ${todo.length}. ⌘Z undoes it.`;
  } catch (e) {
    lastMessage = "";
    setStatus("Rename failed: " + e.message, true);
    return;
  }
  await refresh();
}

// Any edit to the form clears the "Renamed N" note so the status describes the next click.
function onFormChange() {
  lastMessage = "";
  render();
}

addRuleRow();
$("addRule").addEventListener("click", () => { addRuleRow(); render(); });
["prefix", "suffix", "numSep", "numStart", "numDigits"].forEach((id) => $(id).addEventListener("input", onFormChange));
["matchCase", "useRegex", "numOn", "numPos", "order"].forEach((id) => $(id).addEventListener("change", onFormChange));
$("apply").addEventListener("click", apply);

action.addNotificationListener(["select", "set", "make", "delete", "move", "open", "close"], scheduleRefresh);
refresh();
