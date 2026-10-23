# BackupHub

Cross-platform desktop app (Windows / macOS / Linux) for scheduled backups of databases, AWS S3 objects, and remote server files.

Built with **Electron**, **TypeScript**, **electron-vite**, and **Vue 3**.

## Requirements

- Node.js **22.12+** (see `.nvmrc`)
- npm 10+
- Platform build tools for native modules (`better-sqlite3`):
  - Linux: `build-essential`, Python 3
  - macOS: Xcode CLT
  - Windows: Visual Studio Build Tools

## Quick start

```bash
nvm use        # or install Node 22+
npm install    # rebuilds native deps for Electron via postinstall
npm run dev
```

### Linux: Chrome SUID sandbox

If Electron aborts with `chrome-sandbox is not configured correctly`, BackupHub already passes `--no-sandbox` on Linux by default (renderer `contextIsolation` / preload sandbox stay on).

Optional — use Chromium’s SUID helper instead:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
BACKUPHUB_ELECTRON_NO_SANDBOX=0 npm run dev
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development with HMR |
| `npm run build` | Typecheck + compile main/preload/renderer |
| `npm run pack` | Build unpacked app directory (`release/…-unpacked`) |
| `npm run dist` | Build installers for the current OS |
| `npm run dist:linux` | AppImage + deb |
| `npm run dist:win` | NSIS installer |
| `npm run dist:mac` | DMG |
| `npm test` | Vitest unit tests |
| `npm run rebuild` | Force-rebuild `better-sqlite3` for Electron |
| `npm run typecheck` | Strict TypeScript checks |
| `npm run lint` | ESLint |

## Security model

- Renderer isolation: `contextIsolation: true`, `nodeIntegration: false`, typed preload `window.backupHub` only.
- Electron `webPreferences.sandbox` is **false** (required for electron-vite’s bundled CJS preload; `sandbox: true` silently drops the preload). Chromium OS sandbox is separate (`--no-sandbox` on Linux when SUID helper is missing).
- Every IPC payload is validated with **Zod**.
- Credentials (passwords, private keys, AWS secrets) are stored with Electron **safeStorage** (Phase 2) — never plaintext in SQLite.
- SSH/SFTP also stores **host keys** in `ssh_host_keys` (trust-on-first-use + fingerprint prompt). Host-key verification and credential encryption are **both required**; one does not replace the other.
- **SSH tunnel for databases:** MySQL/MariaDB/Postgres/MSSQL/MongoDB profiles can select an existing SSH/SFTP profile as a jump host. The DB host/port are the address *as seen from the SSH server* (often `127.0.0.1:3306`). Test Connection opens a local port-forward, connects, then closes the tunnel.
- Secrets are never logged (pino redaction).

## Data layout

Application data lives under Electron `userData`:

```
userData/
  data/backuphub.sqlite
  logs/backuphub.*.log
  drivers/<tool>/<version>/
```

### SQLite + Drizzle ORM

Local app data uses **better-sqlite3** via **Drizzle ORM** (`src/main/db/schema.ts`).

SQL migrations live in `/drizzle` and are applied with Drizzle’s migrator (`__drizzle_migrations`). Packaged builds copy that folder to `resources/drizzle`.

```bash
npm run db:generate   # after schema changes
```

Tables: `profiles`, `tasks`, `task_runs`, `cycles`, `file_manifest`, `settings`, `ssh_host_keys`

If you already ran an older Phase 1 build that used the custom `schema_migrations` table, delete `userData/data/backuphub.sqlite` once so Drizzle can create a clean DB.

## Backup behavior (product rules)

Implemented in the Phase 4 planner/engine (`src/shared/backup/`, `src/main/backup/`):

1. **`fullBackup=true` without `fullPeriod`** — every scheduled run performs a complete backup (raw or zip depending on `compress`).
2. **`fullBackup=true` with `fullPeriod`** — first run creates a full baseline cycle. Later runs store only changes under timestamped folders (plus `deleted.json`). When the period ends, the next run finalizes the cycle (optional zip into `archives/`, verify, delete unzipped cycle) and starts a new baseline.
3. **`fullBackup=false`** — after the first baseline, only changes are backed up (no cycle rollover).

**Run now** / scheduled runs transfer files for **SFTP, FTP/FTPS, and SSH (SFTP subsystem)** into the cycle layout. Set `remotePath` on the profile (default `.`). Exclude patterns on the task skip matching relative paths. AWS S3 and database sources arrive in Phases 6–7.

Target folder layout:

```
<target>/<taskName>/
  cycles/<yyyy-mm-dd>_full/
    baseline/
    changes/<timestamp>/
    manifest.json
  archives/<taskName>_<start>_<end>.zip
```

## Packaging

`electron-builder` config: `electron-builder.yml`

| OS | Artifact |
| --- | --- |
| Windows | NSIS `.exe` installer |
| macOS | `.dmg` |
| Linux | `.AppImage` and `.deb` |

Output directory: `release/`.

Native modules are rebuilt for Electron (`npmRebuild: true`, `postinstall` → `electron-builder install-app-deps`).

## Roadmap phases

1. **Scaffold** — IPC, SQLite, logging, tray, packaging
2. Connection profiles + safeStorage + test connection + SSH tunnels
3. Scheduler + task CRUD/wizard
4. Backup engine core (cycles, manifest, zip, tests)
5. Server files (SFTP/FTP) *(current)*
6. AWS S3
7. Database adapters + Driver Manager (MSSQL: **sqlpackage `.bacpac` first**; native `.bak` later) — downloads from [drivers.taam.shop](https://drivers.taam.shop/drivers/)
8. Restore & verify
9. Notifications, retention, catch-up, polish
10. Final packaging + electron-updater

## Project layout

```
src/main/          Electron main process (Drizzle DB, IPC, tray, logger)
drizzle/           Drizzle SQL migrations (packaged as extraResources)
src/preload/       contextBridge API
src/renderer/      Vue 3 UI
src/shared/        Shared types, Zod schemas, path helpers
tests/             Vitest unit tests
driver-mirror/     Python script to download/re-host CLI drivers (see that README)
```

### Driver mirror (for offline / self-hosted Driver Manager)

Official mirror: **https://drivers.taam.shop/drivers/** (wired in `src/shared/driversMirror.ts`).

```bash
cd driver-mirror
python3 download_drivers.py
# upload out/** to the mirror; HOSTED_LINKS.json tracks published URLs
```

Full instructions: [`driver-mirror/README.md`](driver-mirror/README.md)

### Scheduling + engine (Phases 3–4)

- Tasks store a wizard schedule (every / daily / weekly / monthly / cron) plus an executable cron expression.
- Main process runs **croner** jobs (timezone-aware, overrun protection). Each tick enqueues a `pending` `task_runs` row.
- A backup **worker** claims pending runs (respects `globalConcurrency`), plans the cycle action, and prepares target layout / zip on rollover.
- Tasks UI: **Run now** queues a real SFTP/FTP/SSH backup. History lists recent runs.
- File profiles: optional **Remote path** (`options.remotePath`) is the directory tree to back up.

## License

MIT
