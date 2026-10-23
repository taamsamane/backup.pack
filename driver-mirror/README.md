# BackupHub driver mirror

Python helper that downloads **all external CLI drivers** BackupHub needs from official upstreams, hashes them (SHA-256), and lays them out so you can upload to GitHub Releases or your own server.

After you host the files, send the download links (or a filled `HOSTED_LINKS` JSON) so Phase 7 Driver Manager can pull from **your** mirror instead of vendor CDNs.

## Directory

```
/home/milad/Project/devpos-pack/driver-mirror/
```

| Path | Purpose |
| --- | --- |
| `catalog.json` | Pinned tool versions + official source URLs |
| `download_drivers.py` | Downloader (stdlib only — no pip packages) |
| `out/` | Generated downloads + `manifest.json` (**gitignored**) |
| `out/HOSTED_LINKS.example.json` | Template for the links you send back |

## What gets downloaded

| Tool id | Provides | Platforms in catalog |
| --- | --- | --- |
| `sqlpackage` | MSSQL **.bacpac** export (primary MSSQL strategy) | linux-x64, darwin-x64, win-x64 |
| `mongodb-database-tools` | `mongodump` / `mongorestore` | linux-x64, darwin-x64/arm64, win-x64 |
| `postgresql` | `pg_dump` / `pg_restore` / `psql` | linux-x64/arm64, darwin-x64/arm64, win-x64 |
| `mariadb` | `mysqldump` / `mysql` (MySQL + MariaDB) | linux-x64, win-x64 |
| `7zip` | Optional AES-256 archives | linux-x64/arm64, darwin-arm64, win-x64 |

**Not downloaded (by design):**

- SQLite — bundled via `better-sqlite3`
- AWS — `@aws-sdk/client-s3` (no CLI)
- SSH/SFTP/FTP — Node libraries (`ssh2`, `basic-ftp`); credentials encrypted with **safeStorage**; server identity via **`ssh_host_keys`**
- Native MSSQL `.bak` — deferred; we prioritize **sqlpackage `.bacpac`**

## Run

```bash
cd /home/milad/Project/devpos-pack/driver-mirror

# Preview
python3 download_drivers.py --dry-run

# Download everything (large: MariaDB packages are hundreds of MB)
python3 download_drivers.py

# Smaller smoke test
python3 download_drivers.py --tools 7zip sqlpackage --platforms linux-x64
```

Requires **Python 3.10+**, network access, and disk space (full catalog ≈ several GB).

## Output layout

```
out/
  manifest.json
  HOSTED_LINKS.example.json
  sqlpackage/170.4.83.3/linux-x64/sqlpackage-linux-x64.zip
  mongodb-database-tools/100.11.0/linux-x64/...
  postgresql/18.6.1/linux-x64/...
  mariadb/11.4.5/linux-x64/...
  7zip/25.01/linux-x64/...
```

Each `manifest.json` entry includes `sha256`, `sizeBytes`, `sourceUrl`, and expected binary paths inside the archive.

## After upload — what to send back

1. Upload `out/<tool>/<version>/<platform>/*` to GitHub Releases or a static file host.
2. Copy `out/HOSTED_LINKS.example.json` → e.g. `HOSTED_LINKS.json`.
3. Set either:
   - `baseUrl` so each file is `{baseUrl}/{relativePath}`, **or**
   - a full `hostedUrl` per artifact.
4. Send **`HOSTED_LINKS.json`** (and/or the release page URL) in chat.

Example base URL shapes:

```text
https://github.com/<you>/<repo>/releases/download/drivers-v1/
https://cdn.example.com/backuphub-drivers/v1/
```

## License note

You are redistributing **third-party** binaries. Keep their licenses and upstream attribution when you publish the mirror.
