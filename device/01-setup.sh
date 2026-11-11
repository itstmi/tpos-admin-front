#!/bin/bash
# Base security for tposadminfront. Run as root on the device.
# A 5 minute safety timer turns the firewall off again unless it is stopped
# after a successful login from a new PC cmd window.
set -euo pipefail

LAN="192.168.100.0/24"
TIMER=tposadminfront-safety

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }
[ "$(hostname)" = "tposadminfront" ] || { echo "wrong device: $(hostname)"; exit 1; }
grep -q . /root/.ssh/authorized_keys || { echo "no SSH key in authorized_keys, stopping"; exit 1; }
sshd -T | grep -q '^passwordauthentication no' || { echo "password login is still on, stopping"; exit 1; }

echo "== Auto install off (package lists still refresh) =="
cat > /etc/apt/apt.conf.d/52tpos-no-auto-upgrade <<'A'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "0";
A
apt-config dump | grep -E 'APT::Periodic::(Unattended-Upgrade|Update-Package-Lists) '

echo "== Install ufw =="
planned=$(apt-get install -s ufw | grep '^Inst' | awk '{print $2}' | tr '\n' ' ')
if [ -n "$planned" ] && [ "$planned" != "ufw " ]; then
  echo "apt wants more than ufw: $planned"; exit 1
fi
DEBIAN_FRONTEND=noninteractive apt-get install -y -q ufw
ufw --version | head -n 1

echo "== Safety timer =="
systemctl stop "$TIMER.timer" 2>/dev/null || true
systemd-run --unit="$TIMER" --on-active=300 /usr/sbin/ufw disable

echo "== Firewall: deny incoming, SSH from office LAN only =="
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$LAN" to any port 22 proto tcp comment 'SSH from office LAN'
ufw --force enable
ufw status verbose

echo "== Unused services off =="
systemctl disable --now rpcbind.service rpcbind.socket openvpn.service 2>&1 | grep -v '^Removed' || true
for s in rpcbind.service rpcbind.socket openvpn.service; do
  printf '%-18s %s\n' "$s" "$(systemctl is-enabled "$s" 2>/dev/null || true)"
done
ss -tuln | grep -E ':111\b' || echo "port 111 closed"

echo "== SETUP DONE =="
echo "Open a NEW PC cmd and log in with the key. If it works, stop the timer:"
echo "  systemctl stop $TIMER.timer"
