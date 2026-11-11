#!/bin/bash
# WhatsApp tunnel from tposadminfront to WAHA on Panther 1, same setup as the backend device.
# WAHA is reachable only on 127.0.0.1:3001 inside this device.
set -euo pipefail
cd "$(dirname "$0")"

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }
[ "$(hostname)" = "tposadminfront" ] || { echo "wrong device: $(hostname)"; exit 1; }
[ -s /root/.ssh/wa_tunnel_ed25519 ] || { echo "missing tunnel key"; exit 1; }
ssh-keygen -F 192.168.100.82 -f /root/.ssh/known_hosts >/dev/null || { echo "Panther host key not in known_hosts"; exit 1; }

waha_code() { curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:3001/api/version || true; }

install -m 644 -o root -g root wa-tunnel-1.service /etc/systemd/system/wa-tunnel-1.service
systemctl daemon-reload
systemctl enable --now wa-tunnel-1
sleep 3
echo "service: $(systemctl is-active wa-tunnel-1), WAHA $(waha_code) (401 expected)"
ss -tln | grep ':3001 ' || { echo "3001 not listening"; exit 1; }

echo "== Reconnect test =="
pkill -f "L 127.0.0.1:3001:127.0.0.1:3001" || true
sleep 10
echo "after kill: $(systemctl is-active wa-tunnel-1), WAHA $(waha_code)"
echo "== WA TUNNEL DONE =="
