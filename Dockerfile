FROM node:18-bullseye-slim

# Instala o Chromium e o GIT (necessário para baixar o motor do WhatsApp)
RUN apt-get update && apt-get install -y \
    chromium \
    git \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# O Git agora está presente, então o npm install vai funcionar!
RUN npm install

COPY . .

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 8080
CMD ["node", "index.js"]
