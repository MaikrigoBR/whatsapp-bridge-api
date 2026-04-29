const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');

const app = express();
app.use(require('cors')());
app.use(express.json({ limit: '50mb' }));
const port = process.env.PORT || 3001;

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};
const db = getFirestore(initializeApp(firebaseConfig));
const AUTH_PATH = path.join(__dirname, '.wwebjs_auth');

async function saveSession() {
    console.log("💾 Salvando cópia do login no Firebase...");
    const output = fs.createWriteStream('session.zip');
    const archive = archiver('zip');
    archive.pipe(output);
    archive.directory(AUTH_PATH, false);
    await archive.finalize();
    const base64 = fs.readFileSync('session.zip', { encoding: 'base64' });
    await setDoc(doc(db, "system_metadata", "whatsapp_session"), { data: base64, updated: new Date().toISOString() });
    console.log("✅ Backup concluído!");
}

async function loadSession() {
    try {
        const snap = await getDoc(doc(db, "system_metadata", "whatsapp_session"));
        if (snap.exists()) {
            console.log("📂 Restaurando login do Firebase...");
            fs.writeFileSync('session.zip', snap.data().data, { encoding: 'base64' });
            await fs.createReadStream('session.zip').pipe(unzipper.Extract({ path: AUTH_PATH })).promise();
            console.log("✅ Login restaurado!");
        }
    } catch (e) { console.log("Sem backup para restaurar."); }
}

async function start() {
    await loadSession();
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'] }
    });
    client.on('qr', () => console.log("📲 ESCANEIE O QR NO PAINEL"));
    client.on('ready', () => { console.log('✅ CONECTADO!'); saveSession(); });
    client.initialize();
}

app.get('/api/status', (req, res) => res.json({ status: 'active' }));
app.listen(port, () => start());

