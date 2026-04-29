FROM node:18-bullseye-slim

# Instala o básico + ferramentas de download e chaves
RUN apt-get update && apt-get install -y \
    chromium \
    git \
    openssh-client \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Força o Git a usar HTTPS (mais simples e rápido)
RUN git config --global url."https://github.com/".insteadOf git@github.com: && \
    git config --global url."https://".insteadOf git://

COPY package*.json ./
RUN npm install

COPY . .

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 8080
CMD ["node", "index.js"]
