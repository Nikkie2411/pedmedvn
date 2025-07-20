# Dockerfile for backend
FROM node:22-alpine

# Install build dependencies for bcrypt
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm rebuild bcrypt --build-from-source

COPY . .

EXPOSE 3000

USER node

CMD ["node", "app.js"]
