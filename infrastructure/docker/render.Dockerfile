FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ffmpeg ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/* && npm install --global pnpm@10.33.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
COPY src ./src
COPY migrations ./migrations
COPY tsconfig.json ./
RUN mkdir -p /app/data /app/.render && chown -R node:node /app/data /app/.render
USER node
ENV FFMPEG_PATH=/usr/bin/ffmpeg FFPROBE_PATH=/usr/bin/ffprobe
ENV REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium
CMD ["pnpm", "worker"]
