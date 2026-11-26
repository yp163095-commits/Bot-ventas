const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot de ventas corriendo ✅');
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});

const MI_NUMERO = '527321134837';

async function startBot() {
  // CAMBIE LA CARPETA A auth_info2 PARA QUE EMPIECE LIMPIO
  const { state, saveCreds } = await useMultiFileAuthState('auth_info2');
  
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Bot Ventas', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(MI_NUMERO);
        console.log('======================================');
        console.log('TU CODIGO PARA VINCULAR ES: ' + code);
        console.log('======================================');
      } catch (e) {
        console.log('Error pidiendo codigo:', e.message);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexion cerrada, reconectando:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ BOT LISTO Y CONECTADO!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase();
    const jid = msg.key.remoteJid;
    if (!jid.endsWith('@s.whatsapp.net')) return;

    let respuesta = '';
    if (texto.includes('hola') || texto.includes('buenas') || texto.includes('info')) {
      respuesta = 'Hola! 👋 Bienvenido. ¿En qué te puedo ayudar hoy? \n\nEscribe *precio* para ver precios, o *pedido* para hacer un pedido.';
    } else if (texto.includes('precio') || texto.includes('costo') || texto.includes('cuanto')) {
      respuesta = 'Con gusto! ¿Qué producto te interesa? Mándame el nombre y te paso precio y disponibilidad.';
    } else if (texto.includes('pedido') || texto.includes('comprar') || texto.includes('quiero')) {
      respuesta = 'Perfecto! Para tu pedido dime: \n1. Qué producto quieres\n2. Cuántos\n3. A dónde es la entrega';
    } else if (texto.includes('gracias')) {
      respuesta = 'De nada! Aquí estamos para ayudarte 😊';
    }

    if (respuesta) {
      await sock.sendMessage(jid, { text: respuesta });
    }
  });
}

startBot();
