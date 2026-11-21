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
CMD ["node", "dist/server.mjs"]
