FROM node:20-alpine

RUN apk add --no-cache curl python3

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY raioflix-proxy.js ./

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "raioflix-proxy.js"]
