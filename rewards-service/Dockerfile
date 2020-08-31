FROM node:14-alpine

ENV NODE_ENV production

WORKDIR /opt/orbs

COPY .version ./version
COPY shared/package*.json /opt/shared/
COPY shared/dist /opt/shared/dist

COPY rewards-service/package*.json ./

RUN apk add --no-cache git 
RUN npm install

COPY rewards-service/dist ./dist

CMD [ "npm", "start" ]
