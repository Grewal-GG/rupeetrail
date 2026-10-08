# RupeeTrail

A private, single-user banknote encounter journal. PHP + SQLite, camera/photo OCR in the browser, no login and no possession tracking in v0.1.

## Run on Ubuntu with Docker

```sh
git clone YOUR_REPOSITORY_URL rupeetrail
cd rupeetrail
docker compose up -d --build
```

The app binds to localhost port 8087, deliberately not every server interface. Put your existing HTTPS reverse proxy in front of `http://127.0.0.1:8087`, reachable only through your private access setup. If the proxy runs inside Docker, connect the containers on a shared network and proxy to `app:80` instead. Do not publish the unauthenticated app to the public internet. Browser camera behaviour is best over HTTPS; the file chooser can also select existing images. This release uses the native photo chooser with rear-camera capture hint, not a continuous video scanner.

For LAN-only access, change the port binding to `YOUR_SERVER_LAN_IP:8087:80`. Anyone with network access to that address can read, edit or delete data. A firewall or private tunnel is the access boundary; CSRF protection is not authentication.

## Local development

Requires PHP 8.3+ with PDO SQLite:

```sh
php -S 127.0.0.1:8087 -t public
```

Open http://127.0.0.1:8087. Never open index.html directly for real use. The database defaults to `data/rupeetrail.sqlite`; Docker uses a persistent named volume mounted at `/data`. Do not run `docker compose down -v` unless you intend to delete data.

## Scan a note

Choose the denomination, photograph one serial panel, move the crop strip over the number, and click Read selected panel. Check the complete serial including prefix, leading zeros and star. Correct OCR mistakes before checking the confirmation box and saving. No photograph is sent to this app's server or stored in the database. OCR runs using Tesseract.js in your browser. The initial scanner engine/model downloads need internet; CDN scripts and fonts also make external requests. Offline support is not included.

RBI says serial numbers can repeat across notes with a different inset letter, printing year or governor signature. Matching here uses denomination + serial + optional series/year/inset/governor. Blank identity fields create provisional matches. Fill them consistently; adding them later may split a previously grouped identity. OCR is an aid, not guaranteed identification. This does not detect counterfeit notes or track where a note travelled. Statistics refer to recorded identities and sightings, not verified circulation or possession.

## Git repository

```sh
git init
git add .
git commit -m "Build RupeeTrail v0.1"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

Create the empty private repository in your Git hosting account first. Data, backups and environment secrets are ignored. Release tags: `git tag v0.1.0` and `git push origin v0.1.0`.

## Updates and backups

Run `sh scripts/update.sh` from your server checkout. It stops on local changes, creates a consistent SQLite snapshot, then pulls main and rebuilds. Inspect release changes before updating; the script does not perform automatic rollback. Keep copies of backups on another device. JSON/CSV exports are for portability; use SQLite backups for full restoration.

Backup manually:

```sh
mkdir -p backups
docker compose exec -T app php -r '$db=new PDO("sqlite:/data/rupeetrail.sqlite");$db->exec("VACUUM INTO ". $db->quote("/data/manual-backup.sqlite"));'
docker compose cp app:/data/manual-backup.sqlite backups/manual-backup.sqlite
docker compose exec -T app rm /data/manual-backup.sqlite
```

Restore: stop the app, keep a copy of current data, replace the database in the named volume with the chosen backup using a temporary container, remove old `-wal` and `-shm` files while the app is stopped, set ownership to `www-data` (33:33 in this image), then start the app. Verify history and adding a record. Do not overwrite the running database. Database version 1 is recorded in `schema_migrations`; future schema changes must be explicit migrations, not database replacement.

## Checks

```sh
php tests/validation.php
node --check public/assets/app.js
```

## Design and dependencies

Original warm-paper interface, forest-green abstract note graphic and yellow action buttons. Geist font with system fallback. GSAP entrance and scroll reveal respect reduced motion. Pinned CDN versions: GSAP 3.12.5 and Tesseract.js 6.0.1. Third-party libraries retain their own licenses. Details references were unavailable due to a paid-plan access error; no Details resource was copied.

## Next releases

Login, possession status, verified returns, PWA/offline queue and locally hosted OCR assets are intentionally deferred.
