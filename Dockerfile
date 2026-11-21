# Container image for Cloud Run or any container host (Vercel is the primary target).
# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: plain Alpine plus the Node binary, one bundled server file and the static client.
# Copying only the binary (instead of the node image) leaves out npm and yarn; apk is removed below.
FROM alpine:3.22
ENV NODE_ENV=production PORT=8080
# Install the one runtime library, add a non-root user, then remove the package manager itself.
RUN apk add --no-cache libstdc++ && adduser -D -u 1000 app && apk --purge del apk-tools
COPY --from=build /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=build --chown=app:app /app/dist ./dist
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8080/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server.mjs"]
