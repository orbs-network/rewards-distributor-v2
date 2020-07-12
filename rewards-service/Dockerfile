FROM node:12-alpine

ENV NODE_ENV production

WORKDIR /opt/orbs

RUN mkdir -p /opt/shared/
COPY shared/package*.json /opt/shared/
COPY shared/dist /opt/shared/dist

COPY rewards-service/package*.json ./
COPY rewards-service/entrypoint.sh /opt/orbs/service

RUN apk add --no-cache git 
RUN apk add --no-cache daemontools --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing
RUN npm install

COPY rewards-service/dist ./dist

CMD [ "npm", "start" ]
