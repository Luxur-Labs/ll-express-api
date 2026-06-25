#!/usr/bin/env bash
# Read all SSM parameters under a path prefix and write Docker Compose env_file (.env.prod).
# Each parameter's *name* must end with the environment variable key, e.g.:
#   /luxur/prod/DATABASE_URL  ->  DATABASE_URL=...
#   /luxur/prod/JWT_SECRET    ->  JWT_SECRET=...
#
# Requires: AWS CLI, instance profile or credentials with ssm:GetParametersByPath on this path.
# Run on EC2 from repo root or ll-express-api directory (script resolves output path).
#
# Usage:
#   chmod +x scripts/ssm-to-env-prod.sh
#   ./scripts/ssm-to-env-prod.sh <region> <ssm-path-prefix> [output-file]
set -euo pipefail

REGION="${1:?Usage: $0 <region> <ssm-path-prefix> [output-file]}"
PREFIX="${2:?Missing ssm-path-prefix argument}"

_self="${BASH_SOURCE[0]}"
[[ "$_self" != /* ]] && _self="$(pwd)/$_self"
SCRIPT_DIR="$(cd "$(dirname "$_self")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [[ "$REPO_ROOT" == "/" ]]; then
  echo "Could not resolve repo root (avoid running this script with cwd / and a relative path)." >&2
  echo "Fix: cd to your ll-express-api directory and run ./scripts/ssm-to-env-prod.sh ..." >&2
  echo "Or pass the output file explicitly as the 3rd argument." >&2
  exit 1
fi

OUT="${3:-$REPO_ROOT/.env.prod}"
case "$OUT" in
  "/" | "/." | "/.env.prod" | "/.env.prod.tmp")
    echo "Refusing to write to $OUT; pass a writable path as the 3rd argument." >&2
    exit 1
    ;;
esac

mkdir -p "$(dirname "$OUT")"

TMP="${OUT}.tmp.$$"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

python3 - "$REGION" "$PREFIX" "$TMP" <<'PY'
import json, subprocess, sys

region, prefix, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
params = []
token = None

while True:
    cmd = [
        "aws",
        "ssm",
        "get-parameters-by-path",
        "--region",
        region,
        "--path",
        prefix,
        "--with-decryption",
        "--recursive",
        "--output",
        "json",
        "--max-results",
        "10",
    ]
    if token:
        cmd.extend(["--starting-token", token])
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(
            proc.stderr
            or proc.stdout
            or "aws ssm get-parameters-by-path failed (no stderr/stdout)\n"
        )
        if not (proc.stderr or proc.stdout):
            sys.stderr.write(
                "Hint: check IAM (ssm:GetParametersByPath), region, and that the path prefix exists.\n"
            )
        sys.exit(1)
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Invalid JSON from aws CLI: {e}\n{proc.stdout[:500]!r}\n")
        sys.exit(1)
    params.extend(data.get("Parameters") or [])
    token = data.get("NextToken")
    if not token:
        break

if not params:
    print(
        f"Warning: no SSM parameters under prefix {prefix!r} in {region!r} "
        f"(.env.prod will be empty; fix the path or create parameters).",
        file=sys.stderr,
    )

def strip_wrapping_quotes(raw):
    """SSM/console pastes often include extra '...' or \"...\" around the real value — peel them."""
    s = str(raw).strip()
    while len(s) >= 2 and s[0] == s[-1] and s[0] in "'\"":
        s = s[1:-1].strip()
    return s


def compose_env_value(raw):
    """Format for Docker Compose env_file (.env): KEY= with double-quoted VALUE (not shell shlex)."""
    s = strip_wrapping_quotes(raw)
    s = s.replace("$", "$$")  # literal $ in Compose env files
    escaped = (
        s.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
    )
    return f'"{escaped}"'


lines = []
for p in params:
    name = p["Name"]
    key = name.rsplit("/", 1)[-1]
    if key:
        lines.append(f"{key}={compose_env_value(p['Value'])}")

with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + ("\n" if lines else ""))
PY

mv "$TMP" "$OUT"
trap - EXIT
chmod 600 "$OUT"

if [[ ! -f "$OUT" ]]; then
  echo "Error: expected file missing after write: $OUT" >&2
  exit 1
fi
BYTES=$(wc -c <"$OUT" | tr -d ' ')
ABS=$(readlink -f "$OUT" 2>/dev/null || realpath "$OUT" 2>/dev/null || echo "$OUT")
echo "Wrote $OUT ($BYTES bytes)"
echo "  Absolute path: $ABS"
if [[ "$OUT" == *"/home/"*"/opt/"* ]] || [[ "$REPO_ROOT" == *"/home/"*"/opt/"* ]]; then
  echo "  Note: this is under your home directory (…/home/…/opt/…), not the system folder /opt/…." >&2
  echo "  Docker Compose looks for .env.prod next to compose files — use the same path in env_file." >&2
fi
