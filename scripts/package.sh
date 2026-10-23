#!/bin/sh
# Builds dist/artboard-renamer-<version>.ccx. A .ccx is a zip of the plugin folder with the
# manifest at its root; Creative Cloud installs it on double-click.
set -eu
cd "$(dirname "$0")/.."

version=$(node -p 'require("./src/manifest.json").version')
pkg_version=$(node -p 'require("./package.json").version')
if [ "$version" != "$pkg_version" ]; then
  echo "Version mismatch: src/manifest.json has $version, package.json has $pkg_version" >&2
  exit 1
fi

out="dist/artboard-renamer-$version.ccx"
mkdir -p dist
rm -f "$out"
(cd src && zip -q -X "../$out" manifest.json index.html index.js rename.js styles.css)
echo "$out"
