# One image for every entrypoint. Default: the API.
# Other processes: override the command, e.g. `node dist/apps/worker/index.mjs`.
FROM node:24-alpine AS base
WORKDIR /app
# tatara:slot docker-base

FROM base AS build
# tatara:slot docker-build

FROM base AS runtime
ENV NODE_ENV=production
# tatara:slot docker-runtime
USER node
EXPOSE 3000
CMD ["node", "dist/apps/api/server.mjs"]
