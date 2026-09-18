# node:18-slim ist kompatibel mit docker-compose 1.29.2
# (neuere alpine-Images enthalten kein ContainerConfig mehr → KeyError)
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
