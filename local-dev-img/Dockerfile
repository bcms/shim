FROM node:14-slim

WORKDIR /app

COPY dist /app
COPY licenses /app/licenses
COPY .env.dev /app

RUN npm i
RUN npm i -D env-cmd

ENTRYPOINT ["npm", "run", "start:local"]
