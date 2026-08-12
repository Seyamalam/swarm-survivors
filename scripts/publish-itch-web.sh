#!/usr/bin/env bash

set -euo pipefail

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly ITCH_TARGET="${ITCH_TARGET:-seyamalam/swarm-survivors:html5}"

cd "$ROOT_DIR"

if [[ "${1:-}" == "--skip-build" ]]; then
  skip_build=true
elif [[ $# -eq 0 ]]; then
  skip_build=false
else
  echo "Usage: $0 [--skip-build]" >&2
  exit 2
fi

if [[ "$skip_build" == false ]]; then
  npm run build:web
fi

if [[ -z "${BUTLER_API_KEY:-}" && -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [[ -z "${BUTLER_API_KEY:-}" ]]; then
  echo "BUTLER_API_KEY is required in the environment or .env.local." >&2
  exit 1
fi

if ! command -v butler >/dev/null 2>&1; then
  echo "The itch.io butler CLI is required on PATH." >&2
  exit 1
fi

version="$(node -p "require('./package.json').version")"
revision="${GITHUB_SHA:-$(git rev-parse --short HEAD)}"
revision="${revision:0:7}"

for attempt in 1 2 3; do
  if butler push dist "$ITCH_TARGET" --userversion "${version}-${revision}"; then
    exit 0
  fi

  if [[ "$attempt" -eq 3 ]]; then
    break
  fi

  delay=$((attempt * 10))
  echo "Butler upload attempt $attempt failed; retrying in ${delay}s." >&2
  sleep "$delay"
done

echo "Butler could not complete the itch.io upload after three attempts." >&2
exit 1
