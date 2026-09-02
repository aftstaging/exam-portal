#!/usr/bin/env bash
#
# One-shot EC2 (Ubuntu 24.04) provisioning for the AFT learning portal.
#
# Usage:
#   sudo bash deploy/setup-ec2.sh /path/to/aft-learning-portal <YOUR_DOMAIN>
#
# Provison the instance first (t3.small or larger), open ports 80/443 in the
# security group, then run this as root. Follow the prompts for the DB password
# and .env values.
set -euo pipefail

APP_SRC="${1:?usage: setup-ec2.sh <path-to-repo> <domain>}"
DOMAIN="${2:?usage: setup-ec2.sh <path-to-repo> <domain>}"
APP_DIR=/opt/aft-learning-portal

echo "==> Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git nginx mysql-server certbot \
  python3-certbot-nginx

echo "==> Installing Node.js 24 (NodeSource)"
if ! command -v node >/dev/null 2>&1 || ! node -v 2>/dev/null | grep -q "^v24"; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

echo "==> Installing pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm@10
fi

echo "==> Preparing MySQL database"
read -r -s -p "   DB password for user 'aftportal': " DB_PASSWORD
echo ""
mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS aft_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'aftportal'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER 'aftportal'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON aft_portal.* TO 'aftportal'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "==> Installing app to ${APP_DIR}"
rm -rf "${APP_DIR}"
mkdir -p "${APP_DIR}"
cp -a "${APP_SRC}/." "${APP_DIR}/"
cd "${APP_DIR}"

echo "==> Writing .env"
cp .env.example .env
JWT_SECRET="$(openssl rand -hex 48)"
# Readable sed for the DATABASE_URL password (may contain @ : / which are fine here)
sed -i "s|CHANGE_ME_DB_PASSWORD|${DB_PASSWORD}|" .env
sed -i "s|CHANGE_ME_openssl_rand_hex_48|${JWT_SECRET}|" .env
echo "   Generated JWT_SECRET and wrote .env. Fill in S3 + PayFast from the portal:\n"
grep -nE "^(AWS_REGION|S3_BUCKET|AWS_ACCESS_KEY_ID|PAYFAST_)" .env || true

echo "==> Installing dependencies"
pnpm install --frozen-lockfile=false

echo "==> Running database migrations"
export DATABASE_URL="mysql://aftportal:${DB_PASSWORD}@localhost:3306/aft_portal"
pnpm exec drizzle-kit migrate

echo "==> Building production bundle"
pnpm build

echo "==> Installing systemd unit"
cp deploy/aft-portal.service /etc/systemd/system/aft-portal.service
systemctl daemon-reload
systemctl enable --now aft-portal.service

echo "==> Installing nginx site"
nginx -t || true
rm -f /etc/nginx/sites-enabled/default
cp deploy/nginx-aft-portal.conf /etc/nginx/sites-available/aft-portal
sed -i "s|<YOUR_DOMAIN>|${DOMAIN}|g" /etc/nginx/sites-available/aft-portal
ln -sf /etc/nginx/sites-available/aft-portal /etc/nginx/sites-enabled/aft-portal
systemctl reload nginx 2>/dev/null || systemctl restart nginx

echo ""
echo "==> Done."
echo "    App is running at http://localhost:3000 (Node) behind nginx."
echo ""
echo "    Next steps:"
echo "      1) HTTPS with Let's Encrypt:"
echo "         sudo certbot --nginx -d ${DOMAIN}"
echo "      2) Fill in S3 bucket/credentials + PayFast keys in ${APP_DIR}/.env, then:"
echo "         sudo systemctl restart aft-portal"
echo "      3) Create the owner/admin account by registering with:"
echo "         OWNER_EMAIL (default: admin@accountantsfortomorrow.co.za)"
echo "         (anyone registering with that email is auto-promoted to admin)"