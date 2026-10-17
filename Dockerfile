FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production PORT=3000 SANDBOX_ID_FILE=/state/.sandbox-id
RUN mkdir -p /state && chown node:node /state
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
