// Pure naming logic, kept apart from the Photoshop API so it can be tested under node.

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileReplacements(replacements, { matchCase, useRegex }) {
  const flags = matchCase ? "g" : "gi";
  return replacements
    .map((r, i) => ({ ...r, position: i + 1 }))
    .filter((r) => r.find !== "")
    .map((r) => {
      let pattern;
      try {
        pattern = new RegExp(useRegex ? r.find : escapeRegExp(r.find), flags);
      } catch (e) {
        throw new Error(`Replacement ${r.position}: ${e.message}`);
      }
      // A function replacement stops "$1" or "$&" in plain text from being read as a pattern.
      return { pattern, replace: useRegex ? r.replace : () => r.replace };
    });
}

// Layers panel order: the top artboard first, as the panel lists them.
function stackOrder(items) {
  return [...items].sort((a, b) => b.stackIndex - a.stackIndex);
}

// Reading order on the canvas: rows top to bottom, left to right within a row.
function canvasOrder(items) {
  const byTop = [...items].sort((a, b) => a.top - b.top || a.left - b.left);
  const rows = [];
  for (const item of byTop) {
    const row = rows[rows.length - 1];
    // Artboards in a grid rarely share an exact top edge, so a row holds everything that starts
    // above the middle of its first artboard.
    if (row && item.top < row.middle) row.items.push(item);
    else rows.push({ middle: (item.top + item.bottom) / 2, items: [item] });
  }
  return rows.flatMap((row) => row.items.sort((a, b) => a.left - b.left));
}

function computeNames(items, options) {
  const rules = compileReplacements(options.replacements || [], options);
  const ordered = options.order === "canvas" ? canvasOrder(items) : stackOrder(items);
  const number = options.number || {};

  const rows = ordered.map((item, i) => {
    let name = item.name;
    for (const rule of rules) name = name.replace(rule.pattern, rule.replace);
    name = (options.prefix || "") + name + (options.suffix || "");
    if (number.enabled) {
      const n = String(number.start + i).padStart(number.digits, "0");
      const sep = number.separator || "";
      name = number.position === "before" ? n + sep + name : name + sep + n;
    }
    return { id: item.id, oldName: item.name, newName: name };
  });

  const counts = new Map();
  for (const row of rows) counts.set(row.newName, (counts.get(row.newName) || 0) + 1);
  for (const row of rows) {
    row.empty = row.newName.trim() === "";
    row.changed = row.newName !== row.oldName;
    row.duplicate = counts.get(row.newName) > 1;
  }
  return rows;
}

module.exports = { computeNames };
