const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// AJUSTE DE PORTA DINÂMICA PARA O RENDER
const port = process.env.PORT || 3001; 

const qrcodeLib = require('qrcode');
let qrBase64 = null;
let isReady = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process' // ECONOMIZA MUITA MEMÓRIA NO RENDER
        ]
    }
});

client.on('qr', async (qr) => {
    console.log('NOVO QR CODE GERADO:');
    qrcode.generate(qr, { small: true });
    try { qrBase64 = await qrcodeLib.toDataURL(qr); } catch (err) {}
});

client.on('ready', () => {
    console.log('✅ WHATSAPP CONECTADO!');
    isReady = true;
    qrBase64 = null;
});

app.get('/api/status', (req, res) => {
    res.json({ isReady, qrCode: qrBase64 });
});

app.post('/api/send', async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'WhatsApp Desconectado' });
    const { phone, message } = req.body;
    try {
        let cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
        const chatId = cleanPhone + "@c.us";
        await client.sendMessage(chatId, message);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`API Rodando na porta ${port}`);
    client.initialize();
});
