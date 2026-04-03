# Wave-1 hardening: image build now enforces digest pinning via build-arg policy.
# CI must pass NODE_BASE_DIGEST (sha256:...) from repo variable/secret.
ARG NODE_BASE_IMAGE=node:22.14.0-alpine3.21
ARG NODE_BASE_DIGEST
FROM ${NODE_BASE_IMAGE}@${NODE_BASE_DIGEST} AS runtime

ENV NODE_ENV=production
WORKDIR /app

# minimal copy for deterministic dependency install
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# application source only
COPY src ./src

# runtime hardening
RUN addgroup -g 10001 -S smartcart \
  && adduser -S -D -H -u 10001 -G smartcart smartcart \
  && chown -R smartcart:smartcart /app
USER 10001:10001

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
