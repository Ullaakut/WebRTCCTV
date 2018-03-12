FROM node:7.10

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app


EXPOSE 7000
CMD [ "npm", "start" ]

COPY package.json /usr/src/app/
RUN npm install
COPY src /usr/src/app/src