#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LEVEL="patch"
DRY_RUN=false
DO_COMMIT=false
DO_TAG=false
LEVEL_SET=false

for arg in "$@"; do
  case "$arg" in
    patch|minor|major|--from-commits)
      if [ "$LEVEL_SET" = true ]; then
        echo "Error: multiple bump levels specified" >&2
        exit 1
      fi
      LEVEL="$arg"
      LEVEL_SET=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --commit)
      DO_COMMIT=true
      ;;
    --tag)
      DO_TAG=true
      ;;
    -h|--help)
      echo "Usage: $0 [patch|minor|major|--from-commits] [--dry-run] [--commit] [--tag]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if [ ! -f VERSION ]; then
  echo "Error: VERSION file not found" >&2
  exit 1
fi

CURRENT="$(tr -d '[:space:]' < VERSION)"
if ! [[ "$CURRENT" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Error: invalid SemVer in VERSION: $CURRENT" >&2
  exit 1
fi
MAJOR="${BASH_REMATCH[1]}"
MINOR="${BASH_REMATCH[2]}"
PATCH="${BASH_REMATCH[3]}"

if [ "$LEVEL" = "--from-commits" ]; then
  LAST_TAG="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)"
  if [ -n "$LAST_TAG" ]; then
    MSGS="$(git log "${LAST_TAG}..HEAD" --format=%B)"
  else
    MSGS="$(git log --format=%B 2>/dev/null || true)"
  fi
  if printf '%s\n' "$MSGS" | grep -qE '(^BREAKING CHANGE:|^[a-z]+(\([^)]+\))?!:)'; then
    LEVEL="major"
  elif printf '%s\n' "$MSGS" | grep -qE '^feat(\([^)]+\))?:'; then
    LEVEL="minor"
  else
    LEVEL="patch"
  fi
fi

case "$LEVEL" in
  major)
    NEXT="$((MAJOR + 1)).0.0"
    ;;
  minor)
    NEXT="${MAJOR}.$((MINOR + 1)).0"
    ;;
  patch)
    NEXT="${MAJOR}.${MINOR}.$((PATCH + 1))"
    ;;
esac

if [ "$DRY_RUN" = true ]; then
  echo "${CURRENT} -> ${NEXT}"
  exit 0
fi

printf '%s\n' "$NEXT" > VERSION

node -e '
const fs = require("node:fs");
const next = process.argv[1];

const p = "skills/open-points-overview/SKILL.md";
const content = fs.readFileSync(p, "utf8");
const updated = content.replace(/^version:\s*.*$/m, "version: " + next);
if (updated === content && !content.includes("version: " + next)) {
  console.error("Failed to update version in " + p);
  process.exit(1);
}
fs.writeFileSync(p, updated, "utf8");

if (fs.existsSync("package.json")) {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  pkg.version = next;
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

if (fs.existsSync("extension.yml")) {
  const ext = fs.readFileSync("extension.yml", "utf8");
  const updatedExt = ext.replace(/^(\s*version:\s*)["']?\d+\.\d+\.\d+["']?\s*$/m, "$1\"" + next + "\"");
  fs.writeFileSync("extension.yml", updatedExt, "utf8");
}
' "$NEXT"

node scripts/validate.mjs >/dev/null

if [ "$DO_COMMIT" = true ]; then
  git add VERSION skills/open-points-overview/SKILL.md package.json extension.yml
  git commit -m "chore(release): bump version to v${NEXT} [skip ci]"
fi

if [ "$DO_TAG" = true ]; then
  git tag -a "v${NEXT}" -m "Release v${NEXT}"
fi

echo "$NEXT"
