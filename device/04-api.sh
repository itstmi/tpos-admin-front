#!/bin/bash
# Installs or updates the admin API from this repo into /opt/tposadmin/api and runs it with apm2.
# First run asks for the two host names and the super admin email; they stay in .env only.
set -euo pipefail

APP_USER=tposadmin
REPO=/root/tpos-admin-front
DEST=/opt/tposadmin/api
ENV_FILE=$DEST/.env
NAME=tpos-admin-api
PORT=3100

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }
[ "$(hostname)" = "tposadminfront" ] || { echo "wrong device: $(hostname)"; exit 1; }
[ -r /etc/tposadmin/db-apikey ] || { echo "db key file missing"; exit 1; }
node -e 'require("node:crypto").argon2Sync' >/dev/null 2>&1 || { echo "node without argon2"; exit 1; }

echo "== Files =="
install -d -o root -g "$APP_USER" -m 750 /opt/tposadmin "$DEST"
rm -rf "$DEST/src"
cp -r "$REPO/api/src" "$DEST/src"
cp "$REPO/api/package.json" "$REPO/api/package-lock.json" "$REPO/api/.npmrc" "$DEST/"
chown -R root:"$APP_USER" "$DEST/src" "$DEST/package.json" "$DEST/package-lock.json" "$DEST/.npmrc"
find "$DEST/src" -type d -exec chmod 750 {} +
find "$DEST/src" -type f -exec chmod 640 {} +
chmod 640 "$DEST/package.json" "$DEST/package-lock.json" "$DEST/.npmrc"

echo "== Packages =="
cd "$DEST"
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
chown -R root:"$APP_USER" node_modules
chmod -R g+rX,o-rwx node_modules
npm audit --omit=dev

echo "== .env =="
if [ ! -f "$ENV_FILE" ]; then
  read -rp "Panel host (super admin): " PANEL_HOST
  read -rp "App API host (sub admin): " APP_HOST
  read -rp "Super admin email: " ADMIN_EMAIL
  for h in "$PANEL_HOST" "$APP_HOST"; do
    [[ "$h" =~ ^[a-z0-9-]+\.tpos\.pk$ ]] || { echo "bad host: $h"; exit 1; }
  done
  [[ "$ADMIN_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[a-z]+$ ]] || { echo "bad email"; exit 1; }
  umask 027
  cat > "$ENV_FILE" <<E
PORT=$PORT
TZ=Asia/Karachi
DB_URL=http://192.168.100.80:8000/rest/v1/
DB_KEY_FILE=/etc/tposadmin/db-apikey
PANEL_HOST=$PANEL_HOST
APP_HOST=$APP_HOST
APP_CLIENT_KEY=$(openssl rand -hex 32)
SUPER_ADMIN_EMAIL=$ADMIN_EMAIL
CF_TEAM_DOMAIN=
CF_AUD=
E
  echo ".env created"
else
  echo ".env kept"
fi
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"
grep -c '=' "$ENV_FILE" | sed 's/^/env lines: /'

echo "== Run =="
cd /tmp
if apm2 describe "$NAME" >/dev/null 2>&1; then
  apm2 restart "$NAME" --update-env >/dev/null
else
  apm2 start "$DEST/src/server.js" --name "$NAME" --cwd "$DEST" \
    --node-args="--env-file=$ENV_FILE" --time >/dev/null
fi
apm2 save >/dev/null
sleep 3
apm2 list | grep -E "$NAME|name"

echo "== Checks =="
ss -ltn | grep ":$PORT " || { echo "not listening"; exit 1; }
set -a; . "$ENV_FILE"; set +a
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
echo "wrong host:        $(code -H 'Host: x.tpos.pk' http://127.0.0.1:$PORT/api/app/me) (want 404)"
echo "panel, no CF yet:  $(code -H "Host: $PANEL_HOST" http://127.0.0.1:$PORT/api/panel/me) (want 503)"
echo "app, no key:       $(code -H "Host: $APP_HOST" http://127.0.0.1:$PORT/api/app/me) (want 404)"
echo "app, key no token: $(code -H "Host: $APP_HOST" -H "X-App-Key: $APP_CLIENT_KEY" http://127.0.0.1:$PORT/api/app/me) (want 401)"
echo "login, bad input:  $(code -H "Host: $APP_HOST" -H "X-App-Key: $APP_CLIENT_KEY" -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:$PORT/api/app/login) (want 400)"
echo "login, no user:    $(code -H "Host: $APP_HOST" -H "X-App-Key: $APP_CLIENT_KEY" -H 'Content-Type: application/json' -d '{"username":"nobody_x","password":"x","device_id":"test-device-1"}' http://127.0.0.1:$PORT/api/app/login) (want 401)"
apm2 logs "$NAME" --lines 5 --nostream --err 2>/dev/null | tail -n 5
echo "== DONE =="
