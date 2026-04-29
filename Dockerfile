FROM node:18-bullseye-slim

# Apenas o Chromium e Fontes (O básico necessário)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# Como o link acima é um "tarball", o npm não vai pedir Git nem SSH!
RUN npm install

COPY . .

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 8080
CMD ["node", "index.js"]
