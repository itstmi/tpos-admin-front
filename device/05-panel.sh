#!/bin/bash
# Builds the super admin panel from this repo and puts it in /opt/tposadmin/panel, where the API serves it.
# Without panel/package-lock.json in the repo (first run) it makes one in the build folder to be committed.
set -euo pipefail

APP_USER=tposadmin
REPO=/root/tpos-admin-front
BUILD=/root/panel-build
DEST=/opt/tposadmin/panel

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }
[ "$(hostname)" = "tposadminfront" ] || { echo "wrong device: $(hostname)"; exit 1; }

echo "== Files =="
rm -rf "$BUILD"
mkdir -p "$BUILD"
cp -r "$REPO/panel/." "$BUILD/"
cd "$BUILD"

echo "== Packages =="
if [ -f package-lock.json ]; then
  npm ci --ignore-scripts --no-audit --no-fund --loglevel=error
else
  echo "no lockfile in repo, making one: $BUILD/package-lock.json"
  npm install --ignore-scripts --no-audit --no-fund --loglevel=error
fi
npm audit
npm audit signatures
echo "packages: $(npm ls --all --parseable | wc -l)"

echo "== Build =="
npx --no-install vite build
if find dist -name '*.map' | grep -q .; then echo "source maps found"; exit 1; fi

echo "== Install =="
rm -rf "$DEST.new"
cp -r dist "$DEST.new"
chown -R root:"$APP_USER" "$DEST.new"
find "$DEST.new" -type d -exec chmod 750 {} +
find "$DEST.new" -type f -exec chmod 640 {} +
rm -rf "$DEST.old"
[ -d "$DEST" ] && mv "$DEST" "$DEST.old"
mv "$DEST.new" "$DEST"
rm -rf "$DEST.old"
ls -l "$DEST" "$DEST/assets"
md5sum package-lock.json

echo "== DONE =="
