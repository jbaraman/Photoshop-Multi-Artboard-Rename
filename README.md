# Artboard Renamer for Photoshop

A Photoshop panel that renames many artboards at once, the way Finder's **Rename** does for files:
find and replace text, add a prefix or suffix, and number them, all with a live preview.

## Features

- **Replace text**: as many find → replace rows as you need, applied in order. Optional *Match case*
  and *Regular expressions* (capture groups work: `^(\d+)x(\d+)` → `$2 $1`).
- **Add text**: a prefix and a suffix.
- **Add a number**: before or after the name, with a separator, a start number and zero-padding
  (`_01`, `_02`…). Numbering follows the Layers panel (top first) or the canvas (rows, left to right).
- **Live preview** of old → new names. It flags names that would come out the same twice, and skips
  names that would come out empty.
- **One undo step**: a single ⌘Z / Ctrl+Z puts every name back.

Only selected artboards are renamed. Other selected layers are ignored.

## Requirements

Photoshop 2022 (23.3) or later. Developed and tested on Photoshop 2026 on macOS.

## Install

**From a release:** download `artboard-renamer-<version>.ccx` from
[Releases](../../releases) and double-click it. Creative Cloud installs it after a warning that the
developer isn't verified. Then open **Plugins → Artboard Renamer** in Photoshop.

**From source:** install Adobe's **UXP Developer Tool** from the Creative Cloud app, turn on
*Enable Developer Mode* in Photoshop (Settings → Plugins), then in the tool choose
*Add Plugin* → `src/manifest.json` → *Load*.

## Use

1. In the Layers panel, select the artboards to rename.
2. Fill in any of the sections. The preview updates as you type.
3. Click **Rename**.

The fields keep their values after a rename, and the preview shows what the next click would do.
Clicking Rename again applies the changes again (a prefix would be added twice).

## Development

The renaming logic lives in `src/rename.js`, with no Photoshop calls, so it can be tested under
Node 18 or later:

```bash
npm test
```

Build the installer into `dist/`:

```bash
npm run package
```

| File | What it does |
| --- | --- |
| `src/manifest.json` | UXP manifest (panel entry point, host version) |
| `src/index.html`, `src/styles.css` | Panel layout |
| `src/index.js` | Reads the selection, draws the preview, renames through `batchPlay` |
| `src/rename.js` | Pure naming logic |
| `src/rename.test.js` | Tests for the naming logic |

## License

[MIT](LICENSE)
