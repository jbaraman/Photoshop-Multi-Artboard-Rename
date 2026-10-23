const test = require("node:test");
const assert = require("node:assert/strict");
const { computeNames } = require("./rename.js");

const board = (id, name, extra = {}) => ({ id, name, stackIndex: 100 - id, top: 0, left: 0, bottom: 100, ...extra });
const names = (rows) => rows.map((r) => r.newName);

test("applies every replacement row in order", () => {
  const rows = computeNames([board(1, "Banner Summer 300x250")], {
    replacements: [{ find: "Banner", replace: "Ad" }, { find: "Summer", replace: "Winter" }],
  });
  assert.deepEqual(names(rows), ["Ad Winter 300x250"]);
});

test("replaces every occurrence, ignoring case unless asked", () => {
  const items = [board(1, "big Big BIG")];
  assert.deepEqual(names(computeNames(items, { replacements: [{ find: "big", replace: "x" }] })), ["x x x"]);
  assert.deepEqual(
    names(computeNames(items, { matchCase: true, replacements: [{ find: "big", replace: "x" }] })),
    ["x Big BIG"],
  );
});

test("treats plain find text literally, including regex characters and $ in the replacement", () => {
  const rows = computeNames([board(1, "Price (old).v1")], {
    replacements: [{ find: "(old).", replace: "$1 new " }],
  });
  assert.deepEqual(names(rows), ["Price $1 new v1"]);
});

test("regular expressions support capture groups", () => {
  const rows = computeNames([board(1, "300x250 Banner")], {
    useRegex: true,
    replacements: [{ find: "^(\\d+)x(\\d+) (.*)$", replace: "$3 $1×$2" }],
  });
  assert.deepEqual(names(rows), ["Banner 300×250"]);
});

test("an invalid regular expression names the row it came from", () => {
  assert.throws(
    () => computeNames([board(1, "a")], { useRegex: true, replacements: [{ find: "ok", replace: "" }, { find: "(", replace: "" }] }),
    /^Error: Replacement 2:/,
  );
});

test("rows with an empty find field are skipped", () => {
  const rows = computeNames([board(1, "Hero")], { replacements: [{ find: "", replace: "X" }] });
  assert.deepEqual(names(rows), ["Hero"]);
  assert.equal(rows[0].changed, false);
});

test("adds prefix and suffix after replacing", () => {
  const rows = computeNames([board(1, "Hero")], {
    replacements: [{ find: "Hero", replace: "Main" }],
    prefix: "FB_",
    suffix: "_v2",
  });
  assert.deepEqual(names(rows), ["FB_Main_v2"]);
});

test("numbers artboards with padding, start and position", () => {
  const items = [board(1, "A"), board(2, "B"), board(3, "C")];
  const after = computeNames(items, { number: { enabled: true, position: "after", separator: "_", start: 9, digits: 2 } });
  assert.deepEqual(names(after), ["A_09", "B_10", "C_11"]);
  const before = computeNames(items, { prefix: "p-", number: { enabled: true, position: "before", separator: " ", start: 1, digits: 1 } });
  assert.deepEqual(names(before), ["1 p-A", "2 p-B", "3 p-C"]);
});

test("layers panel order puts the top artboard first", () => {
  const items = [board(1, "bottom", { stackIndex: 1 }), board(2, "top", { stackIndex: 5 }), board(3, "middle", { stackIndex: 3 })];
  assert.deepEqual(computeNames(items, { order: "stack" }).map((r) => r.oldName), ["top", "middle", "bottom"]);
});

test("canvas order reads rows left to right, tolerating uneven top edges", () => {
  const items = [
    board(1, "row2-left", { top: 300, left: 0, bottom: 500 }),
    board(2, "row1-right", { top: 4, left: 400, bottom: 204 }),
    board(3, "row1-left", { top: 0, left: 0, bottom: 200 }),
    board(4, "row2-right", { top: 310, left: 400, bottom: 510 }),
  ];
  assert.deepEqual(
    computeNames(items, { order: "canvas" }).map((r) => r.oldName),
    ["row1-left", "row1-right", "row2-left", "row2-right"],
  );
});

test("flags duplicate, empty and unchanged results", () => {
  const rows = computeNames([board(1, "Ad 1"), board(2, "Ad 2"), board(3, "X")], {
    useRegex: true,
    replacements: [{ find: "\\s*\\d+$", replace: "" }, { find: "^X$", replace: "" }],
  });
  assert.deepEqual(
    rows.map(({ newName, duplicate, empty, changed }) => ({ newName, duplicate, empty, changed })),
    [
      { newName: "Ad", duplicate: true, empty: false, changed: true },
      { newName: "Ad", duplicate: true, empty: false, changed: true },
      { newName: "", duplicate: false, empty: true, changed: true },
    ],
  );
});
