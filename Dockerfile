FROM node:12-slim

WORKDIR /app

COPY dist/. /app

ENTRYPOINT ["npm", "start"]
