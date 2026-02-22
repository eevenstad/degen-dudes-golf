#!/usr/bin/env python3
"""
Degen Dudes Score Backup Script
Pulls all game data from Supabase and saves to disk.
Run via launchd every 3 hours during the golf trip (Feb 26 - Mar 2).
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timezone, timedelta

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://lnnlabbdffowjpaxvnsp.supabase.co"
KEY_FILE     = Path.home() / ".config" / "supabase" / "degen-dudes-service-role"
BACKUP_DIR   = Path.home() / "code" / "degen-dudes" / "backups"
MAX_BACKUPS  = 30

TABLES = [
    "players",
    "courses",
    "scores",
    "groups",
    "group_players",
    "matches",
    "match_players",
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def read_service_key() -> str:
    """Read the Supabase service role key from disk (never log it)."""
    try:
        return KEY_FILE.read_text().strip()
    except FileNotFoundError:
        print(f"ERROR: Service role key not found at {KEY_FILE}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR reading service key: {e}", file=sys.stderr)
        sys.exit(1)


def fetch_table(table: str, key: str) -> list:
    """Fetch all rows from a Supabase REST table."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*"
    req = urllib.request.Request(url)
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Accept", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"ERROR fetching {table}: HTTP {e.code} — {body[:200]}", file=sys.stderr)
        raise
    except Exception as e:
        print(f"ERROR fetching {table}: {e}", file=sys.stderr)
        raise


def prune_backups(backup_dir: Path, keep: int) -> None:
    """Delete oldest backup files, keeping the most recent `keep` files."""
    files = sorted(backup_dir.glob("scores-*.json"), key=lambda f: f.stat().st_mtime)
    to_delete = files[:-keep] if len(files) > keep else []
    for f in to_delete:
        try:
            f.unlink()
        except Exception as e:
            print(f"WARNING: could not delete old backup {f.name}: {e}", file=sys.stderr)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    # 1. Read key
    key = read_service_key()

    # 2. Ensure backup dir exists
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # 3. Fetch all tables
    data = {}
    for table in TABLES:
        try:
            rows = fetch_table(table, key)
            data[table] = rows
        except Exception:
            # Error already printed; fail gracefully
            return 1

    # 4. Build backup bundle
    tz_mst = timezone(timedelta(hours=-7))
    now = datetime.now(tz=tz_mst)
    timestamp = now.isoformat(timespec="seconds")

    bundle = {"backup_timestamp": timestamp}
    bundle.update(data)  # players, courses, scores, …

    # 5. Write to disk
    filename = now.strftime("scores-%Y-%m-%d-%H%M.json")
    backup_path = BACKUP_DIR / filename
    try:
        backup_path.write_text(json.dumps(bundle, indent=2, default=str))
    except Exception as e:
        print(f"ERROR writing backup file: {e}", file=sys.stderr)
        return 1

    # 6. Prune old backups
    prune_backups(BACKUP_DIR, MAX_BACKUPS)

    # 7. Summary (no key in output)
    n_scores  = len(data.get("scores", []))
    n_players = len(data.get("players", []))
    n_matches = len(data.get("matches", []))
    print(
        f"Backup complete: {n_scores} scores, {n_players} players, "
        f"{n_matches} matches saved to {backup_path}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
