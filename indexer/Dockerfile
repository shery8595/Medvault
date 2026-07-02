FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/medvault-core/package.json packages/medvault-core/
COPY packages/medvault-sdk/package.json packages/medvault-sdk/
COPY indexer/package.json indexer/
RUN npm ci --workspace=@medvault/indexer --include-workspace-root

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/medvault-core ./packages/medvault-core
COPY packages/medvault-sdk ./packages/medvault-sdk
COPY indexer ./indexer
RUN npm run build -w @medvault/core && npm run build -w @medvault/indexer
ENV INDEXER_PORT=3300
EXPOSE 3300
CMD ["node", "indexer/dist/index.js"]
