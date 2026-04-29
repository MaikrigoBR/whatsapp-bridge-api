const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeLib = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// GAVETAS GLOBAIS
let qrCodeImage = null;
let isReady = false;
const apiLogs = [];

function addLog(type, ...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    apiLogs.unshift(`[${new Date().toISOString()}] [${type}] ${msg}`);
    if (apiLogs.length > 50) apiLogs.pop();
}

const origLog = console.log;
const origErr = console.error;
console.log = (...args) => { addLog('INFO', ...args); origLog(...args); };
console.error = (...args) => { addLog('ERROR', ...args); origErr(...args); };

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        headless: 'new',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    }
});

// EVENTOS DO WHATSAPP
client.on('qr', (qr) => {
    qrcodeLib.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('[ERROR] Erro ao gerar imagem do QR:', err);
            return;
        }
        qrCodeImage = url;
        addLog('INFO', '📲 QR CODE GERADO COM SUCESSO!');
    });
});

client.on('ready', () => {
    console.log('✅ WHATSAPP CONECTADO E PRONTO!');
    isReady = true;
    qrCodeImage = null;
});

client.on('disconnected', () => {
    console.log('❌ WHATSAPP DESCONECTADO!');
    isReady = false;
    qrCodeImage = null;
    

