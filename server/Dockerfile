FROM node:20-alpine
RUN apk add --no-cache curl logrotate
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/logs /backups
EXPOSE 9456
CMD ["node", "index.js"]
