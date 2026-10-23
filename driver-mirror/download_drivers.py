#!/usr/bin/env python3
"""
Download BackupHub driver/tool packages from official upstream URLs.

Usage:
  python3 download_drivers.py              # download everything in catalog.json
  python3 download_drivers.py --tools 7zip sqlpackage
  python3 download_drivers.py --dry-run
  python3 download_drivers.py --platforms linux-x64 win-x64

Outputs (gitignored):
  out/<tool>/<version>/<platform>/<filename>
  out/manifest.json          # sha256 + metadata for Driver Manager
  out/HOSTED_LINKS.example.json  # fill this after you upload, then send to BackupHub
"""

from __future__ import annotations

import argparse
import hashlib
import json
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT / "catalog.json"
OUT_DIR = ROOT / "out"
USER_AGENT = (
    "BackupHub-DriverMirror/0.1 (+https://github.com/backuphub/backuphub; Python urllib)"
)
CHUNK = 1024 * 256


def load_catalog() -> dict[str, Any]:
    with CATALOG_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            block = fh.read(CHUNK)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def download(url: str, dest: Path, dry_run: bool) -> str | None:
    """Download url to dest. Returns final redirected URL if known."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dry_run:
        print(f"  [dry-run] would download {url} -> {dest}")
        return None

    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [skip] exists ({dest.stat().st_size} bytes): {dest.name}")
        return None

    partial = dest.with_suffix(dest.suffix + ".partial")
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
        },
        method="GET",
    )
    context = ssl.create_default_context()

    try:
        with urllib.request.urlopen(request, context=context, timeout=120) as response:
            final_url = response.geturl()
            total = response.headers.get("Content-Length")
            total_i = int(total) if total and total.isdigit() else None
            written = 0
            with partial.open("wb") as out:
                while True:
                    chunk = response.read(CHUNK)
                    if not chunk:
                        break
                    out.write(chunk)
                    written += len(chunk)
                    if total_i:
                        pct = written * 100 // total_i
                        print(
                            f"\r  downloading {dest.name}: {written}/{total_i} bytes ({pct}%)",
                            end="",
                            flush=True,
                        )
            print()
            partial.replace(dest)
            return final_url
    except urllib.error.HTTPError as err:
        if partial.exists():
            partial.unlink(missing_ok=True)
        raise RuntimeError(f"HTTP {err.code} for {url}") from err
    except Exception:
        if partial.exists():
            partial.unlink(missing_ok=True)
        raise


def build_hosted_links_example(entries: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "baseUrl": "https://YOUR_HOST/backuphub-drivers/v1",
        "comment": (
            "After uploading out/** to GitHub Releases or your server, set baseUrl "
            "OR replace each hostedUrl with a full direct download link. Send this "
            "file (or the links) back so Phase 7 Driver Manager can use your mirror."
        ),
        "artifacts": [
            {
                "toolId": e["toolId"],
                "version": e["version"],
                "platform": e["platform"],
                "filename": e["filename"],
                "sha256": e["sha256"],
                "relativePath": e["relativePath"],
                "hostedUrl": f"https://YOUR_HOST/backuphub-drivers/v1/{e['relativePath']}",
            }
            for e in entries
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--tools",
        nargs="*",
        help="Only download these tool ids (default: all)",
    )
    parser.add_argument(
        "--platforms",
        nargs="*",
        help="Only download these platforms (default: all)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if the file already exists",
    )
    args = parser.parse_args()

    catalog = load_catalog()
    tools = catalog["tools"]
    if args.tools:
        wanted = set(args.tools)
        tools = [t for t in tools if t["id"] in wanted]
        missing = wanted - {t["id"] for t in tools}
        if missing:
            print(f"Unknown tool ids: {', '.join(sorted(missing))}", file=sys.stderr)
            return 2

    entries: list[dict[str, Any]] = []
    failures: list[str] = []

    print(f"Catalog: {CATALOG_PATH}")
    print(f"Output:  {OUT_DIR}")
    print()

    for tool in tools:
        tool_id = tool["id"]
        version = tool["version"]
        print(f"== {tool_id} {version} ==")
        for artifact in tool["artifacts"]:
            platform = artifact["platform"]
            if args.platforms and platform not in args.platforms:
                continue

            filename = artifact["filename"]
            url = artifact["url"]
            dest = OUT_DIR / tool_id / version / platform / filename
            relative = f"{tool_id}/{version}/{platform}/{filename}"

            print(f"- {platform}: {filename}")
            try:
                if args.force and dest.exists() and not args.dry_run:
                    dest.unlink()
                final_url = download(url, dest, args.dry_run)
                if args.dry_run:
                    continue
                digest = sha256_file(dest)
                entry = {
                    "toolId": tool_id,
                    "name": tool["name"],
                    "version": version,
                    "platform": platform,
                    "filename": filename,
                    "relativePath": relative.replace("\\", "/"),
                    "sizeBytes": dest.stat().st_size,
                    "sha256": digest,
                    "sourceUrl": url,
                    "resolvedUrl": final_url,
                    "purpose": tool.get("purpose"),
                    "binaries": tool.get("binaries", {}).get(platform, []),
                    "homepage": tool.get("homepage"),
                    "license": tool.get("license"),
                }
                entries.append(entry)
                print(f"  sha256={digest}")
            except Exception as err:
                msg = f"{tool_id}/{platform}: {err}"
                failures.append(msg)
                print(f"  ERROR: {err}", file=sys.stderr)

        print()

    if args.dry_run:
        print("Dry-run complete (no files written).")
        return 1 if failures else 0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "schemaVersion": catalog.get("schemaVersion", 1),
        "notes": catalog.get("notes", []),
        "mssqlStrategy": "sqlpackage-bacpac",
        "artifactCount": len(entries),
        "artifacts": entries,
    }
    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    links_path = OUT_DIR / "HOSTED_LINKS.example.json"
    links_path.write_text(
        json.dumps(build_hosted_links_example(entries), indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {manifest_path}")
    print(f"Wrote {links_path}")
    print(f"Downloaded {len(entries)} artifact(s).")

    if failures:
        print("\nFailures:", file=sys.stderr)
        for item in failures:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print(
        "\nNext: upload out/<tool>/... to GitHub Releases or your server, "
        "edit HOSTED_LINKS.example.json with real URLs, and send that file back."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
