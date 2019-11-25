FROM node:13.1
WORKDIR /usr/src/app
COPY package.json .
RUN npm install .
COPY src src
CMD ["node", "src/app.js", "--address", "0.0.0.0"]