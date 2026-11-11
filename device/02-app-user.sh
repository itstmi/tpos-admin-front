#!/bin/bash
# App user and pm2 boot startup for tposadminfront. Run as root on the device.
# The admin API runs as "tposadmin", never as root. Use the apm2 wrapper for pm2.
set -euo pipefail

APP_USER=tposadmin
APP_HOME=/home/$APP_USER

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }
[ "$(hostname)" = "tposadminfront" ] || { echo "wrong device: $(hostname)"; exit 1; }
command -v pm2 >/dev/null || { echo "pm2 not installed"; exit 1; }

echo "== User =="
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd -r -m -d "$APP_HOME" -s /usr/sbin/nologin "$APP_USER"
fi
chmod 700 "$APP_HOME"
id "$APP_USER"

echo "== apm2 wrapper =="
cat > /usr/local/bin/apm2 <<W
#!/bin/sh
exec runuser -u $APP_USER -- env HOME=$APP_HOME PM2_HOME=$APP_HOME/.pm2 /usr/local/bin/pm2 "\$@"
W
chmod 755 /usr/local/bin/apm2

echo "== pm2 boot startup =="
pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" | tail -n 2
pm2 kill >/dev/null 2>&1 || true
rm -rf /root/.pm2
systemctl start "pm2-$APP_USER"
printf 'pm2-%s: %s, %s\n' "$APP_USER" "$(systemctl is-enabled pm2-$APP_USER)" "$(systemctl is-active pm2-$APP_USER)"
apm2 ping
runuser -u "$APP_USER" -- cat /root/.ssh/authorized_keys >/dev/null 2>&1 && echo "WARNING: app user can read root files" || echo "isolation OK"

echo "== pm2 log size (system logrotate) =="
cat > /etc/logrotate.d/pm2-$APP_USER <<L
$APP_HOME/.pm2/logs/*.log $APP_HOME/.pm2/pm2.log {
    su $APP_USER $APP_USER
    daily
    rotate 14
    maxsize 10M
    missingok
    notifempty
    compress
    delaycompress
    copytruncate
    dateext
}
L
logrotate -d /etc/logrotate.d/pm2-$APP_USER 2>&1 | grep -i error || echo "logrotate config OK"

echo "== DONE =="
