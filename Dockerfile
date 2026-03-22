FROM node:20-alpine

# Instalar curl e python para sincronização
RUN apk add --no-cache curl python3 py3-pip

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 80

ENV NODE_ENV=production
ENV PORT=80
ENV PAINEL_PORT=80

CMD ["node", "server.js"]
