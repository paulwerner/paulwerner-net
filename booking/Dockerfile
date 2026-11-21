# Builder stage carries a compiler toolchain in case better-sqlite3 has no
# musl prebuild for this Node version; the runtime stage stays toolchain-free.
FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
