FROM node:20-alpine

# Instalar curl para sincronização
RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV PAINEL_PORT=3000

CMD ["node", "server.js"]
