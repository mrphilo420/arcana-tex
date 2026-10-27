FROM node:22-slim AS base

RUN corepack enable pnpm

RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive \
    texlive-latex-extra \
    texlive-pictures \
    texlive-fonts-recommended \
    texlive-science \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY . .
RUN pnpm build

ENV SYNC_DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 3001

CMD ["node", "dist/index.js"]
