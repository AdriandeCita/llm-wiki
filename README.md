# LLM Wiki

A self-contained personal knowledge base where an LLM agent (Claude Code) maintains a directory of markdown files inside a Docker container, while Obsidian on your host gives you a rich reading and browsing interface over the same files in real time. Everything is just files — no databases, no embeddings, no external services.

This project is inspired by this [gist from Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), but includes some extra features specific to my work style:

- **Clear separation of contexts** — need a fresh topic, or want to keep work and personal knowledge apart? Clone the repo into a new directory and spin up as many independent wikis as you like.
- **Isolation** — the agent runs inside Docker, adding a layer of security between it and the host machine when ingesting untrusted or unknown sources.
- **Pluggable models** — Claude Code supports Ollama, so you can swap in your own locally-hosted LLMs.
- **Obsidian integration** — the bundled Obsidian plugin manages the Docker container and provides an embedded Claude terminal panel directly in the vault.

---

## Prerequisites

- **Docker** — must be installed and running
- **Obsidian** — required; the plugin is the entry point for the wiki
- **An Anthropic account** — Claude Code will prompt you to authenticate on first run; no manual API key setup required

---

## Setup

1. Clone this repo into your vault's plugin directory:

```bash
cd <your-vault>/.obsidian/plugins
git clone <repo-url> llm-wiki
cd llm-wiki && npm install && npm run build
```

2. In Obsidian, go to **Settings → Community plugins** and enable **LLM Wiki**.

The plugin will build the Docker image on first launch (takes a few minutes). Subsequent launches are fast.

On first run, Claude Code will walk you through authentication. Your credentials are stored in `.claude/` inside the vault and bind-mounted into the container, so you only authenticate once per vault.

---

## Usage

### Dropping in sources

Copy any files you want the agent to process into `inbox/` inside your vault. The agent reads but never modifies files in `inbox/`.

```bash
cp ~/Downloads/research-paper.pdf <your-vault>/inbox/
cp ~/notes/meeting-notes.txt <your-vault>/inbox/
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

Use a separate Obsidian vault for each domain — each vault is a fully isolated wiki with its own Docker container.

---

## Structure

```
<vault>/
  .obsidian/plugins/llm-wiki/  This plugin
    container/                 Docker assets (Dockerfile, ws-terminal.js, CLAUDE.md template)
  inbox/                       Drop source files here; agent reads them during /ingest
  raw/                         Processed sources land here (moved from inbox/, never modified)
  artifacts/                   Generated outputs ready to share
  CLAUDE.md                    Agent operating instructions (seeded by plugin on first run)
  index.md                     Wiki index (maintained by the agent)
  log.md                       Operation log (maintained by the agent)
```
