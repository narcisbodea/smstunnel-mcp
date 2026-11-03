# SMSTunnel MCP server (stdio): lets AI apps send texts from your own Android phone and your own number.
#
#   docker build -t smstunnel-mcp .
#   docker run -i --rm -e SMSTUNNEL_API_KEY smstunnel-mcp
#
# Your AI app starts the container and talks to it over stdin and stdout (see "Docker" in the README).
#
# The image runs the release published on npm, not this checkout: docker/package.json names one exact
# version of @narcisbodea/smstunnel-mcp, and docker/package-lock.json pins it and its dependencies by
# sha512, so `npm ci` stops if the registry ever serves different bytes. Move it to a new release only
# after that release is on npm (PUBLISHING.md, "Later versions").

# Node.js 24 LTS on Alpine 3.24, pinned by the digest of its multi-platform index.
FROM node:24.22.2-alpine3.24@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS install
WORKDIR /opt/smstunnel-mcp
COPY docker/package.json docker/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24.22.2-alpine3.24@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85
# The server installs nothing while it runs, so the package managers stay out of the final image.
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-v* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
# Owned by root, so the server can't change its own code; it runs as the unprivileged user "node".
COPY --from=install /opt/smstunnel-mcp/node_modules /opt/smstunnel-mcp/node_modules
ENV NODE_ENV=production
WORKDIR /opt/smstunnel-mcp
USER node
ENTRYPOINT ["node", "/opt/smstunnel-mcp/node_modules/@narcisbodea/smstunnel-mcp/dist/index.js"]

LABEL org.opencontainers.image.title="SMSTunnel MCP server" \
      org.opencontainers.image.description="Lets AI apps send texts from your own Android phone and your own number with SMSTunnel." \
      org.opencontainers.image.url="https://smstunnel.io/integrations/mcp/" \
      org.opencontainers.image.documentation="https://github.com/narcisbodea/smstunnel-mcp#readme" \
      org.opencontainers.image.source="https://github.com/narcisbodea/smstunnel-mcp" \
      org.opencontainers.image.vendor="NARBOWEB SRL" \
      org.opencontainers.image.licenses="MIT" \
      io.modelcontextprotocol.server.name="io.github.narcisbodea/smstunnel-mcp"
