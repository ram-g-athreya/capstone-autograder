# https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
# https://buddy.works/guides/how-dockerize-node-application
#FROM node:carbon
FROM node:8
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .
EXPOSE 8080
CMD [ "npm", "start" ]