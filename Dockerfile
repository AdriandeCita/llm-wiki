FROM debian:bookworm-slim

ARG HOST_UID=1000
ARG HOST_GID=1000

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g "$HOST_GID" wiki \
    && useradd -m -s /bin/bash -u "$HOST_UID" -g "$HOST_GID" wiki

WORKDIR /wiki

USER wiki

CMD ["bash"]
