# RupeeTrail

A private, single-user banknote encounter journal. PHP + SQLite, camera/photo OCR in the browser, no login and no possession tracking in v0.1.

## Run on Ubuntu with Docker

```sh
git clone https://github.com/Grewal-GG/rupeetrail rupeetrail
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

Choose the denomination, photograph one serial panel, move the crop strip over the number, and click Read selected panel. Check the complete serial including prefix, leading zeros and star. Correct OCR mistakes before checking the confirmation box and saving. No photograph is sent to this app's server or stored in the database. OCR runs using Tesseract.js in your browser. The scanner engine/model downloads need internet on first use. Offline support is not included.

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

## Dashboard

The app opens directly to totals, quick encounter entry, a denomination breakdown and a searchable, sortable notes table. Manual entry requires denomination, full serial and encounter time (defaults to now in IST); context and identity details are optional. “Add again” copies a saved note’s identity and context with a new encounter time. Editing and deleting remain available in encounter history. Filters affect the table, while dashboard totals always cover all records. Recorded note value counts each identity once; it is not a cash balance.

Reference banknote thumbnails are bundled locally from the [RBI museum](https://www.rbi.org.in/Scripts/pm_republicindia.aspx). They represent denominations, not photographs of your saved notes or an automatic identification of their series. Source URLs are in `public/assets/notes/SOURCES.md`.

The interface uses system fonts and no animation library. Tesseract.js 6.0.1 loads only when you click Read selected panel. Scanner engine/model downloads require internet; manual entry and bundled thumbnails do not. Third-party libraries retain their own licenses.

## Next releases

Login, possession status, verified returns, PWA/offline queue and locally hosted OCR assets are intentionally deferred.
