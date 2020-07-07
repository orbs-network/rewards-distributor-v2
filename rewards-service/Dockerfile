FROM node:12-alpine

ENV NODE_ENV production

WORKDIR /opt/orbs

COPY package*.json ./
COPY entrypoint.sh /opt/orbs/service

RUN apk add --no-cache git 
RUN apk add --no-cache daemontools --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing
RUN npm install

COPY dist ./dist

CMD [ "npm", "start" ]
