#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
test -z "$(git status --porcelain)" || { echo 'Working tree has changes; stopping.'; exit 1; }
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
docker compose exec -T app php -r '$db=new PDO("sqlite:/data/rupeetrail.sqlite");$db->exec("VACUUM INTO ". $db->quote("/data/update-backup.sqlite"));'
docker compose cp app:/data/update-backup.sqlite "backups/$stamp.sqlite"
docker compose exec -T app rm /data/update-backup.sqlite
git pull --ff-only
docker compose up -d --build
echo 'Updated. Check the app and keep the database backup before removing anything.'
