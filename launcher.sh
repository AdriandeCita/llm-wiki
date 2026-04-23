#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# LLM Wiki launcher
# Builds the Docker image if needed, starts the container, opens Obsidian.
# ---------------------------------------------------------------------------

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_TAG="llm-wiki"
CONTAINER_NAME="llm-wiki"
BUILD_HASH_FILE="$REPO_ROOT/.build-hash"
DOCKERFILE="$REPO_ROOT/Dockerfile"

# --- helpers ----------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "WARNING: $*" >&2; }

# --- check Docker -----------------------------------------------------------

if ! command -v docker &>/dev/null; then
    die "docker is not installed or not in PATH."
fi

if ! docker info &>/dev/null; then
    die "Docker daemon is not running. Start Docker and try again."
fi

# --- check Obsidian ---------------------------------------------------------

OBSIDIAN_AVAILABLE=true
if ! command -v obsidian &>/dev/null && ! command -v xdg-open &>/dev/null; then
    warn "Could not find 'obsidian' or 'xdg-open'. Obsidian will not be opened automatically."
    OBSIDIAN_AVAILABLE=false
fi

# --- build image if needed --------------------------------------------------

current_hash="$(sha256sum "$DOCKERFILE" | awk '{print $1}')"
stored_hash=""
if [[ -f "$BUILD_HASH_FILE" ]]; then
    stored_hash="$(cat "$BUILD_HASH_FILE")"
fi

if [[ "$current_hash" != "$stored_hash" ]]; then
    echo "==> Building Docker image '$IMAGE_TAG' ..."
    docker build -t "$IMAGE_TAG" \
        --build-arg HOST_UID="$(id -u)" \
        --build-arg HOST_GID="$(id -g)" \
        "$REPO_ROOT"
    echo "$current_hash" > "$BUILD_HASH_FILE"
    echo "==> Build complete."
else
    echo "==> Docker image '$IMAGE_TAG' is up to date."
fi

# --- ensure .claude and .claude.json exist in the repo root -----------------

mkdir -p "$REPO_ROOT/.claude"
touch "$REPO_ROOT/.claude.json"

# --- start or attach to container -------------------------------------------

WELCOME_MSG=$(cat <<'MSG'
╔══════════════════════════════════════════════════════╗
║               LLM Wiki — Claude Code                ║
╠══════════════════════════════════════════════════════╣
║  /ingest           process files in inbox/          ║
║  /query <question> answer a question from the wiki  ║
║  /publish <topic>  generate a shareable artifact    ║
║  /lint             health-check the wiki            ║
║  /status           show wiki summary                ║
╚══════════════════════════════════════════════════════╝
MSG
)

open_obsidian() {
    if [[ "$OBSIDIAN_AVAILABLE" != "true" ]]; then
        return
    fi

    local os
    os="$(uname -s)"

    case "$os" in
        Linux)
            # Try the obsidian:// URI scheme first; fall back to xdg-open on the directory
            if command -v obsidian &>/dev/null; then
                obsidian "obsidian://open?path=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$REPO_ROOT/wiki")" &>/dev/null &
            else
                xdg-open "$REPO_ROOT" &>/dev/null &
            fi
            ;;
        Darwin)
            if command -v open &>/dev/null; then
                open -a Obsidian "$REPO_ROOT" &>/dev/null &
            fi
            ;;
        *)
            warn "Unknown OS '$os'. Obsidian will not be opened automatically."
            ;;
    esac
}

# --- open Obsidian (non-blocking) -------------------------------------------

open_obsidian

# --- start or attach to container -------------------------------------------

if docker ps --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "==> Container '$CONTAINER_NAME' is already running. Attaching ..."
    docker exec -it "$CONTAINER_NAME" bash
else
    echo "==> Starting container '$CONTAINER_NAME' ..."
    docker run -it --rm \
        --name "$CONTAINER_NAME" \
        -v "$REPO_ROOT:/wiki" \
        -v "$REPO_ROOT/.claude:/home/wiki/.claude" \
        -v "$REPO_ROOT/.claude.json:/home/wiki/.claude.json" \
        "$IMAGE_TAG" \
        bash -c "printf '%s\n\n' \"$WELCOME_MSG\"; exec claude"
fi

# --- wait for container exit ------------------------------------------------

# The docker run above is blocking (interactive). When it returns, the
# container has exited. Obsidian is left running intentionally.

echo "==> Container exited. Obsidian (if open) has been left running."
