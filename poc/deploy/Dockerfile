# Alice Good Meetings for Google Cloud Run: the local service and its page, nothing else.
# The build context is poc/deploy/.stage, which stage.sh fills with only the files of publish-files.txt.
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
# Dependencies first, from the frozen lockfile, production only, with install scripts off.
COPY poc/package.json poc/pnpm-lock.yaml ./poc/
RUN corepack enable && corepack prepare pnpm@12.21.0 --activate \
  && cd poc && pnpm install --prod --frozen-lockfile --ignore-scripts
COPY . .
USER node
# PORT, ALICE_PUBLIC_HOST, ALICE_ACCESS_CODE, ALICE_LOG and OPENAI_API_KEY come from Cloud Run, never from a file in the image.
CMD ["node", "poc/server.mjs"]
