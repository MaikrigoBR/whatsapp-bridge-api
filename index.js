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
// EVENTOS DO WHATSAPP
client.on('qr', (qr) => {
    qrcodeLib.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('[ERROR] Erro ao gerar imagem do QR:', err);
            return;
        }
        qrCodeImage = url;
        addLog('INFO', '📲 NOVO QR CODE GERADO!');
    });
});

// NOVO: Avisa assim que o celular ler o código
client.on('authenticated', () => {
    addLog('INFO', '✅ QR CODE LIDO! SINCRONIZANDO CONVERSAS...');
    qrCodeImage = null; // Para de mostrar o QR Code no site
});

client.on('auth_failure', (msg) => {
    addLog('ERROR', '❌ FALHA NA CONEXÃO: ' + msg);
});

client.on('ready', () => {
    addLog('INFO', '✅ WHATSAPP CONECTADO E PRONTO PARA DISPAROS!');
    isReady = true;
    qrCodeImage = null;
});

client.on('disconnected', (reason) => {
    addLog('ERROR', '❌ WHATSAPP DESCONECTADO: ' + reason);
    isReady = false;
    qrCodeImage = null;
    client.initialize();
});


// ENDPOINTS DA API
app.get('/', (req, res) => {
    res.send('<h1>🤖 WhatsApp Bridge API: ONLINE</h1><p>Acesse /api/status para o QR Code.</p>');
});

app.get('/api/status', (req, res) => {
    res.json({
        isReady,
        qrCode: qrCodeImage,
        lastError: null
    });
});

app.get('/api/logs', (req, res) => {
    res.json(apiLogs);
});

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

const port = process.env.PORT || 8080;
// IMPORTANTE: Adicionamos '0.0.0.0' para o Fly.io conseguir conectar
app.listen(port, '0.0.0.0', () => {
    console.log(`📡 Servidor na porta ${port}`);
    client.initialize().catch(err => {
        console.error('ERRO NA INICIALIZAÇÃO:', err.message || err);
    });
});

