# Usamos uma imagem que já vem com o Chrome e Puppeteer prontos!
FROM ghcr.io/puppeteer/puppeteer:latest

# Pasta do robô
WORKDIR /app

# Copia as peças
COPY package*.json ./

# Instala (usando as permissões certas)
USER root
RUN npm install
COPY . .

# Garante que o robô tenha permissão na pasta de dados
RUN mkdir -p /data/session && chmod -R 777 /data

# Volta para o usuário comum por segurança
USER pptruser

EXPOSE 8080
CMD ["node", "index.js"]

