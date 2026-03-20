FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3480

ENV NODE_ENV=production
ENV PAINEL_PORT=3480

CMD ["node", "server.js"]
