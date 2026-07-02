FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY packages/medvault-core/package.json packages/medvault-core/
COPY packages/medvault-sdk/package.json packages/medvault-sdk/
COPY mcp-server/package.json mcp-server/
RUN npm ci

FROM deps AS dev
WORKDIR /app
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM deps AS build
WORKDIR /app
ARG VITE_PRIVY_APP_ID=clxxxxxxxxxxxxxxxx
ARG VITE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/example/medvault/version/latest
ARG VITE_RECLAIM_ALLOW_SKIP=true
ENV VITE_PRIVY_APP_ID=$VITE_PRIVY_APP_ID
ENV VITE_SUBGRAPH_URL=$VITE_SUBGRAPH_URL
ENV VITE_RECLAIM_ALLOW_SKIP=$VITE_RECLAIM_ALLOW_SKIP
COPY . .
RUN npm run build:prebuilt

FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["serve", "-s", "dist", "-l", "3000"]
