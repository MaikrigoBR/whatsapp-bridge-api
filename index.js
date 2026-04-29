const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeLib = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

let qrCodeImage = null;
let isReady = false;
const apiLogs = [];

function addLog(type, ...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    apiLogs.unshift(`[${new Date().toISOString()}] [${type}] ${msg}`);
    if (apiLogs.length > 50) apiLogs.pop();
}

console.log = (...args) => { addLog('INFO', ...args); };
console.error = (...args) => { addLog('ERROR', ...args); };

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
        executablePath: '/usr/bin/chromium',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
});

client.on('qr', (qr) => {
    // Usamos o serviço do Google para gerar a imagem. É 100% garantido!
    qrCodeImage = `https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(qr)}&chs=300x300&choe=UTF-8`;
    addLog('INFO', '📲 QR CODE DISPONÍVEL VIA GOOGLE API!');
});

client.on('authenticated', () => {
    addLog('INFO', '✅ QR CODE LIDO! SINCRONIZANDO CONVERSAS...');
    qrCodeImage = null;
});

client.on('ready', () => {
    addLog('INFO', '✅ WHATSAPP CONECTADO E PRONTO!');
    isReady = true;
    qrCodeImage = null;
});

client.on('auth_failure', (msg) => {
    addLog('ERROR', '❌ FALHA NA AUTENTICAÇÃO: ' + msg);
    qrCodeImage = null;
});

app.get('/api/status', (req, res) => {
    res.json({ isReady, qrCode: qrCodeImage, lastError: null });
});

app.get('/api/logs', (req, res) => { res.json(apiLogs); });

app.post('/api/send', async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'WhatsApp desconectado.' });
    const { phone, message } = req.body;
    try {
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length <= 11) cleanPhone = '55' + cleanPhone;
        await client.sendMessage(`${cleanPhone}@c.us`, message);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
    console.log(`📡 Servidor na porta ${port}`);
    client.initialize().catch(err => console.error('ERRO:', err.message));
});

