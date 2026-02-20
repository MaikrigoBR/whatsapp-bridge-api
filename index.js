const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const port = 3001; // Rest API Server runs on 3001, distinct from your React app

// Using LocalAuth so you don't need to scan the QR code every time the server restarts
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Prevent memory issues on long-running
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

let isReady = false;

client.on('qr', (qr) => {
    // Generate and scan this code with your phone (WhatsApp Linked Devices)
    console.log('\n================================================');
    console.log('📲  ATENÇÃO: ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP:');
    qrcode.generate(qr, { small: true });
    console.log('================================================\n');
});

client.on('ready', () => {
    console.log('\n✅ Motor do WhatsApp Conectado e Pronto para Disparos!');
    isReady = true;
});

client.on('disconnected', (reason) => {
    console.log('🔴 WhatsApp desconectado. Motivo:', reason);
    isReady = false;
    // Tenta reinicializar após um tempo
    setTimeout(() => {
        console.log('🔄 Tentando reconectar...');
        client.initialize();
    }, 5000);
});

// Impede que o servidor Node congele/caia se houver um erro solto assíncrono
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [URGENTE] Promessa Rejeitada não tratada:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 [CRÍTICO] Exceção não capturada (Crash evitado):', error);
});

client.on('auth_failure', (msg) => {
    console.error('Falha na autenticação do WhatsApp', msg);
});

// --- SISTEMA DE FILA BACKGROUND SEGURO (MÚLTIPLOS USUÁRIOS/LONGAS CAMPANHAS) ---
const campaignQueue = [];
let isProcessingQueue = false;

async function processCampaignQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (campaignQueue.length > 0) {
        const job = campaignQueue.shift();
        console.log(`\n⏳ Iniciando Lote de Campanha: ${job.targets.length} contatos...`);
        
        for (let i = 0; i < job.targets.length; i++) {
            if (!isReady) {
                console.log('Modo Fila pausado / cancelado devido à desconexão do WhatsApp.');
                break;
            }
            
            const target = job.targets[i];
            const { phone, message } = target;
            let cleanPhone = phone.replace(/\D/g, ''); 
            
            if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
                cleanPhone = '55' + cleanPhone;
            }

            try {
                const profile = await client.getNumberId(cleanPhone);
                if (!profile) {
                    console.error(`❌ (Fila) Número ${cleanPhone} não encontrado no WhatsApp.`);
                    continue;
                }
                
                if (job.mediaFiles && job.mediaFiles.length > 0) {
                    for (let j = 0; j < job.mediaFiles.length; j++) {
                        const mediaObj = job.mediaFiles[j];
                        const b64data = mediaObj.base64.replace(/^data:image\/\w+;base64,/, ""); 
                        const finalMedia = new MessageMedia(mediaObj.mimetype, b64data, mediaObj.name || 'image');
                        const options = {};
                        if (j === 0 && message) options.caption = message;
                        
                        await client.sendMessage(profile._serialized, finalMedia, options);
                    }
                    console.log(`📤 (Fila) Mídia para -> ${cleanPhone}`);
                } else if (message) {
                    await client.sendMessage(profile._serialized, message);
                    console.log(`📤 (Fila) Msg para -> ${cleanPhone}`);
                }
            } catch (error) {
                console.error(`⚠️ (Fila) Falha ao enviar para ${cleanPhone}:`, error);
            }
            
            // Pausa humanizada entre disparos: 2 a 5 segundos (evita BAN por Spam e protege a CPU)
            const pauseTime = Math.floor(Math.random() * 3000) + 2000;
            await new Promise(r => setTimeout(r, pauseTime));
        }
        console.log(`🏁 Lote de Campanha Concluído!\n`);
    }

    isProcessingQueue = false;
}

// Endpoint Assíncrono para Campanhas em Massa (Delega o loop pesado para o backend)
app.post('/api/campaign', (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'WhatsApp Desconectado.' });

    const { targets, mediaFiles } = req.body;
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ error: 'Nenhum contato na lista.' });
    }

    campaignQueue.push({ targets, mediaFiles });
    processCampaignQueue().catch(console.error);

    res.status(202).json({ success: true, message: 'Campanha enfileirada e sendo disparada pelo servidor de fundo.' });
});
// --------------------------------------------------------------------------------

// Endpoint that the Stationery Manager React App will POST to for direct 1-1 sends
app.post('/api/send', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: 'Sistema de Disparo do WhatsApp não está conectado via QR Code.' });
    }

    const { phone, message, mediaFiles } = req.body;

    if (!phone) {
        return res.status(400).json({ error: 'Telefone (phone) é obrigatório.' });
    }

    try {
        let cleanPhone = phone.replace(/\D/g, ''); // leave only numbers
        
        // Ensure it starts with 55 (Brazil country code) if it's a Brazilian number missing it
        if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
            cleanPhone = '55' + cleanPhone;
        }
        
        // Verifica se o número existe no WhatsApp e obtém o ID correto
        const profile = await client.getNumberId(cleanPhone);
        
        if (!profile) {
            console.error(`O número ${cleanPhone} não está registrado no WhatsApp.`);
            return res.status(404).json({ error: 'Número não encontrado no WhatsApp.' });
        }
        
        // Se tiver midias anexadas
        if (mediaFiles && mediaFiles.length > 0) {
            for (let i = 0; i < mediaFiles.length; i++) {
                const mediaObj = mediaFiles[i];
                // remove the potential data:image/png;base64, prefix if sent from frontend
                const b64data = mediaObj.base64.replace(/^data:image\/\w+;base64,/, ""); 
                const finalMedia = new MessageMedia(mediaObj.mimetype, b64data, mediaObj.name || 'image');
                
                // Anexa a mensagem de texto como legenda da primeira imagem
                const options = {};
                if (i === 0 && message) {
                    options.caption = message;
                }
                
                await client.sendMessage(profile._serialized, finalMedia, options);
            }
            console.log(`🚀 Mídia(s) com sucesso para WhatsApp -> ${cleanPhone} (${profile._serialized})`);
        } else if (message) {
            // This simulates typing and hitting send for text only
            await client.sendMessage(profile._serialized, message);
            console.log(`🚀 Mensagem invisível com sucesso para WhatsApp -> ${cleanPhone} (${profile._serialized})`);
        } else {
            return res.status(400).json({ error: 'Mensagem ou Mídia deve ser enviada.' });
        }
        
        res.status(200).json({ success: true, message: 'Disparo efetuado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Falha no disparo do WhatsApp.' });
    }
});

app.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`📡 WHATSAPP BRIDGE API INICIADA (Porta ${port})`);
    console.log(`Aguarde o carregamento do motor Chromium (pode levar 1 minuto)...`);
    console.log(`======================================================\n`);
    client.initialize();
});
