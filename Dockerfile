FROM node:18-bullseye-slim

# 1. Instala o básico
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Copia tudo e DELETA o arquivo de trava na força bruta lá dentro do servidor
COPY . .
RUN rm -rf package-lock.json node_modules

# 3. Instala do zero absoluto
RUN npm install --no-package-lock

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 8080
CMD ["node", "index.js"]
