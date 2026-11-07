#!/usr/bin/env bash
# Runs on the VM as root (Ubuntu 24.04). Idempotent: installs Node 22 and Caddy once, unpacks a release, keeps the
# server's secrets and player data across releases, and restarts the service.
# Usage: setup.sh <domain> <release.tar.gz> [env-file]
set -euo pipefail
DOMAIN="${1:?domain}"; TARBALL="${2:?release tarball}"; ENVFILE="${3:-}"
export DEBIAN_FRONTEND=noninteractive

if ! command -v node >/dev/null || ! node -v | grep -qE '^v(2[2-9]|[3-9][0-9])'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

id ashes >/dev/null 2>&1 || useradd --system --home-dir /var/lib/ashes --create-home --shell /usr/sbin/nologin ashes
install -d -m 750 -o ashes -g ashes /var/lib/ashes
install -d -m 750 -o root -g ashes /etc/ashes

# Server secrets are made once here and never leave the VM (they encrypt players' recovery keys).
if [ ! -f /etc/ashes/secrets.env ]; then
  umask 027
  printf 'ASHES_MASTER_KEY=%s\nASHES_HMAC_KEY=%s\n' "$(openssl rand -base64 32)" "$(openssl rand -base64 32)" > /etc/ashes/secrets.env
  chown root:ashes /etc/ashes/secrets.env
  chmod 640 /etc/ashes/secrets.env
fi
if [ -n "$ENVFILE" ]; then
  install -m 640 -o root -g ashes "$ENVFILE" /etc/ashes/env
  shred -u "$ENVFILE" 2>/dev/null || rm -f "$ENVFILE"
fi
[ -f /etc/ashes/env ] || install -m 640 -o root -g ashes /dev/null /etc/ashes/env

RELEASE="/opt/ashes/releases/$(date -u +%Y%m%dT%H%M%S)"
mkdir -p "$RELEASE"
tar -xzf "$TARBALL" -C "$RELEASE"
rm -f "$TARBALL"
(cd "$RELEASE" && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
ln -sfn "$RELEASE" /opt/ashes/app
ls -1dt /opt/ashes/releases/* | tail -n +4 | xargs -r rm -rf   # keep the last three releases

sed "s/{DOMAIN}/$DOMAIN/" /opt/ashes/app/deploy/Caddyfile > /etc/caddy/Caddyfile
install -m 644 /opt/ashes/app/deploy/ashes.service /etc/systemd/system/ashes.service
systemctl daemon-reload
systemctl enable --now caddy >/dev/null
systemctl enable ashes >/dev/null
systemctl restart ashes
systemctl reload caddy || systemctl restart caddy
sleep 2
systemctl is-active ashes caddy
curl -fsS -o /dev/null -w 'local game: HTTP %{http_code}\n' http://127.0.0.1:4173/
