FROM node:alpine
RUN apk update && apk add git && apk add openssh
RUN mkdir -p /usr/src/app
RUN mkdir -p /usr/src/app/workspace

RUN git config --global user.email "sls-bot@lunchbadger.com"
RUN git config --global user.name "SLS API"

WORKDIR /usr/src/app
ENV NODE_ENV production
ENV DEBUG sls:*
COPY package.json package-lock.json /usr/src/app/
RUN npm install

COPY . /usr/src/app

EXPOSE 4444

CMD [ "node", "." ]
