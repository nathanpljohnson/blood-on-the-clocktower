#!/bin/sh
# GitHub Pages needs a full HTML page; claude.ai adds this wrapper to the artifact by itself.
mkdir -p docs
touch docs/.nojekyll
{ printf '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'; cat index.html; printf '\n</body></html>\n'; } > docs/index.html
