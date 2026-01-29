FROM oven/bun:latest

ENV TZ=Asia/Jakarta

WORKDIR /app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY package*.json /app/

RUN bun install --production

COPY . /app

ARG PORT
ENV PORT $PORT
EXPOSE $PORT

USER bun

CMD ["bun", "src/worker-manager.js"]