const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const qrcodeLib = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Página inicial para teste
app.get('/', (req, res) => {
    res.send('<h1>🤖 WhatsApp Bridge API: ONLINE</h1><p>Acesse <a href="/api/status">/api/status</a> para o QR Code.</p>');
});

const port = process.env.PORT || 8080; 

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
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-accelerated-2d-canvas', // NOVO: Ajuda a desenhar o QR
            '--disable-gpu',                  // NOVO: Desliga placa de vídeo
            '--no-first-run', 
            '--no-zygote', 
            '--single-process'
        ]
    }
});

let isReady = false;
let qrBase64 = null;

client.on('qr', async (qr) => {
    console.log('📲 NOVO QR CODE GERADO!');
    try {
        qrBase64 = await qrcodeLib.toDataURL(qr);
    } catch (err) { console.error('Erro ao gerar QR Base64', err); }
});

client.on('ready', () => {
    console.log('✅ WHATSAPP CONECTADO E PRONTO!');
    isReady = true;
    qrBase64 = null;
});

client.on('disconnected', () => {
    isReady = false;
    qrBase64 = null;
    client.initialize();
});

app.get('/api/status', (req, res) => {
    res.json({
        isReady,
        qrCode: qrBase64,
        lastError: null
    });
});

app.get('/api/logs', (req, res) => {
    res.json(apiLogs);
});

// Endpoint de disparo
app.post('/api/send', async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'WhatsApp desconectado.' });
    const { phone, message } = req.body;
    try {
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length <= 11) cleanPhone = '55' + cleanPhone;
        await client.sendMessage(`${cleanPhone}@c.us`, message);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`📡 Servidor na porta ${port}`);
    client.initialize().catch(err => {
        // Agora ele vai mostrar o erro de verdade!
        console.error('ERRO DETALHADO:', err.message || err);
        if (err.stack) console.error('PILHA DO ERRO:', err.stack);
    });
});

