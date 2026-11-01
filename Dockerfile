# SMSTunnel MCP server (stdio). Run it with your key:
#   docker run -i --rm -e SMSTUNNEL_API_KEY smstunnel-mcp
# Build stage: compile TypeScript.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY src ./src
RUN npm run build

# Runtime stage: production dependencies and the compiled server only.
FROM node:22-alpine
LABEL org.opencontainers.image.title="SMSTunnel MCP server" \
      org.opencontainers.image.description="Lets AI apps send texts from your own Android phone and your own number with SMSTunnel." \
      org.opencontainers.image.source="https://github.com/narcisbodea/smstunnel-mcp" \
      org.opencontainers.image.licenses="MIT" \
      io.modelcontextprotocol.server.name="io.github.narcisbodea/smstunnel-mcp"
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
ENTRYPOINT ["node", "dist/index.js"]
