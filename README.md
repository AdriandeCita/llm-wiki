# LLM Wiki

A self-contained personal knowledge base where an LLM agent (Claude Code) maintains a directory of markdown files inside a Docker container, while Obsidian on your host gives you a rich reading and browsing interface over the same files in real time. Everything is just files — no databases, no embeddings, no external services.

This project is inspired by this [gist from Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), but includes some extra features specific to my work style:

- **Clear separation of contexts** — need a fresh topic, or want to keep work and personal knowledge apart? Clone the repo into a new directory and spin up as many independent wikis as you like.
- **Isolation** — the agent runs inside Docker, adding a layer of security between it and the host machine when ingesting untrusted or unknown sources.
- **Pluggable models** — Claude Code supports Ollama, so you can swap in your own locally-hosted LLMs.
- **Obsidian integration** — Obsidian opens alongside the container so you can browse the wiki while the agent updates it (TBD Obsidian Plugin).

---

## Prerequisites

- **Docker** — must be installed and running
- **Obsidian** — optional; if installed, it opens automatically when you launch the wiki
- **An Anthropic account** — Claude Code will prompt you to authenticate on first run; no manual API key setup required

---

## Setup

```bash
# 1. Clone the repository
git clone <repo-url> my-wiki
cd my-wiki

# 2. Make the launcher executable (only needed once)
chmod +x launcher.sh

# 3. Start the wiki
./launcher.sh
```

The first launch builds the Docker image (takes a few minutes). Subsequent launches are fast.

On first run, Claude Code will walk you through authentication. Your credentials are stored in `.claude/` in the project root and bind-mounted into the container, so you only authenticate once per wiki clone.

---

## Usage

### Dropping in sources

Copy any files you want the agent to process into `inbox/`. The agent reads but never modifies files in `inbox/`.

```bash
cp ~/Downloads/research-paper.pdf inbox/
cp ~/notes/meeting-notes.txt inbox/
```

### Commands

Once inside the container, use these commands:

| Command             | Description                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `/ingest`           | Process all files in `inbox/` — extracts information, creates/updates wiki pages, moves sources to `raw/` |
| `/query <question>` | Answer a question using wiki content; optionally save the answer as a new page                            |
| `/publish <topic>`  | Generate a shareable artifact (markdown, Marp slides, or plain text) into `artifacts/`                    |
| `/lint`             | Health-check the wiki: orphan pages, missing pages, contradictions, gaps                                  |
| `/status`           | Show wiki summary: page count, last ingest date, inbox contents                                           |

### Artifacts

When you run `/publish`, the agent saves the output to `artifacts/` with a dated filename. Share or export these files however you like.

---

## Multiple wikis

Clone the repository into a separate directory for each domain — each clone is a fully isolated wiki with its own Docker container.

---

## Structure

```
inbox/        Drop source files here; agent reads them during /ingest
raw/          Processed sources land here (moved from inbox/, never modified)
wiki/         All wiki pages; index.md and log.md are maintained by the agent
artifacts/    Generated outputs ready to share
launcher.sh   Start here — builds the image and opens the container
CLAUDE.md     Agent operating instructions (the schema the agent follows)
Dockerfile    Container definition
```
