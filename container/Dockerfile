FROM debian:bookworm-slim

ARG HOST_UID=1000
ARG HOST_GID=1000

# Install system deps + Node.js + Claude Code
# python3/make/g++ are needed to compile node-pty from source
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    python3 \
    make \
    g++ \
    && curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install the WebSocket→PTY bridge and its dependencies
COPY ws-terminal.js /opt/ws-terminal/ws-terminal.js
WORKDIR /opt/ws-terminal
RUN npm init -y && npm install ws node-pty

RUN groupadd -g "$HOST_GID" wiki \
    && useradd -m -s /bin/bash -u "$HOST_UID" -g "$HOST_GID" wiki

WORKDIR /wiki

USER wiki

CMD ["bash"]
