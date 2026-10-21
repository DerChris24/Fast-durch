FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs index.html sync-client.js ./
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8765 DATA_DIR=/data
USER node
EXPOSE 8765
CMD ["node", "server.mjs"]
