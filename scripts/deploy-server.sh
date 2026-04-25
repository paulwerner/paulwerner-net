#!/usr/bin/env bash
# Idempotent server provisioning for paulwerner.net on Ubuntu 24.04 (ARM64).
# Run as root on a fresh Hetzner CAX11. Safe to re-run.
#
# Usage:
#   scp scripts/deploy-server.sh root@<server>:/root/
#   ssh root@<server> 'bash /root/deploy-server.sh'
set -euo pipefail

REPO_URL="https://github.com/paulwerner/paulwerner-net.git"
APP_DIR="/opt/paulwerner-net"
SWAPFILE="/swapfile"

log() { printf '\n=== %s ===\n' "$*"; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    echo "This script must be run as root." >&2
    exit 1
  fi
}

step_apt_upgrade() {
  log "Updating system packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get upgrade -y
}

step_unattended_upgrades() {
  log "Enabling unattended security upgrades"
  apt-get install -y unattended-upgrades
  dpkg-reconfigure -f noninteractive unattended-upgrades
}

step_harden_ssh() {
  log "Disabling SSH password authentication"
  local cfg=/etc/ssh/sshd_config
  # Normalize any existing PasswordAuthentication line; append if absent.
  if grep -qE '^[# ]*PasswordAuthentication' "$cfg"; then
    sed -i 's/^[# ]*PasswordAuthentication.*/PasswordAuthentication no/' "$cfg"
  else
    echo 'PasswordAuthentication no' >> "$cfg"
  fi
  systemctl restart ssh || systemctl restart sshd
}

step_firewall() {
  log "Configuring UFW (22/80/443)"
  apt-get install -y ufw
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  ufw status verbose
}

step_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker already installed — skipping"
    return
  fi
  log "Installing Docker CE + Compose plugin"
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi
  local arch codename
  arch=$(dpkg --print-architecture)
  codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  docker compose version
}

step_swap() {
  if swapon --show | grep -q "$SWAPFILE"; then
    log "Swap already active — skipping"
    return
  fi
  log "Creating 1G swapfile at $SWAPFILE"
  if [[ ! -f "$SWAPFILE" ]]; then
    fallocate -l 1G "$SWAPFILE"
    chmod 600 "$SWAPFILE"
    mkswap "$SWAPFILE"
  fi
  swapon "$SWAPFILE"
  if ! grep -q "^$SWAPFILE " /etc/fstab; then
    echo "$SWAPFILE none swap sw 0 0" >> /etc/fstab
  fi
}

step_clone_repo() {
  if [[ -d "$APP_DIR/.git" ]]; then
    log "Repo already present — pulling latest"
    git -C "$APP_DIR" pull --ff-only
  else
    log "Cloning repo into $APP_DIR"
    mkdir -p /opt
    git clone "$REPO_URL" "$APP_DIR"
  fi
}

step_env_file() {
  local env_file="$APP_DIR/.env"
  if [[ -f "$env_file" ]]; then
    log ".env already present — leaving untouched"
    return
  fi
  log "Seeding .env from .env.example"
  cp "$APP_DIR/.env.example" "$env_file"
  chmod 600 "$env_file"
  cat <<EOF

A fresh .env was created at $env_file.

Suggested random passwords (use these or generate your own):
  MYSQL_ROOT_PASSWORD: $(openssl rand -base64 24)
  MYSQL_PASSWORD:      $(openssl rand -base64 24)

Edit the file with production values, then start the stack:
  cd $APP_DIR
  docker compose up -d

See docs/deployment.md for the full key list and post-deploy steps.
EOF
}

main() {
  require_root
  step_apt_upgrade
  step_unattended_upgrades
  step_harden_ssh
  step_firewall
  step_docker
  step_swap
  step_clone_repo
  step_env_file
  log "Provisioning complete"
}

main "$@"
