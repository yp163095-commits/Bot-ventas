const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot de ventas corriendo ✅');
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});

const MI_NUMERO = '5217321134837';

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-extensions'
    ],
    timeout: 120000
  }
});

client.on('qr', (qr) => {
  console.log('Escanea este QR:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ BOT LISTO Y CONECTADO!');
});

client.on('authenticated', () => {
  console.log('✅ BOT AUTENTICADO!');
});

client.on('auth_failure', (msg) => {
  console.log('❌ FALLO DE AUTENTICACION:', msg);
});

client.on('loading_screen', (percent, message) => {
  console.log('Cargando WhatsApp:', percent + '%', message);
});

client.initialize().then(async () => {
  setTimeout(async () => {
    try {
      if (!client.info) {
        const code = await client.requestPairingCode(MI_NUMERO);
        console.log('======================================');
        console.log('TU CODIGO PARA VINCULAR ES: ' + code);
        console.log('======================================');
      }
    } catch (e) {
      console.log('Error pidiendo codigo:', e.message);
    }
  }, 5000);
});

client.on('message', async (msg) => {
  if (msg.fromMe) return;
  const texto = msg.body.toLowerCase();

  if (texto.includes('hola') || texto.includes('buenas') || texto.includes('info')) {
    msg.reply('Hola! 👋 Bienvenido. ¿En qué te puedo ayudar hoy? \n\nEscribe *precio* para ver precios, o *pedido* para hacer un pedido.');
  } else if (texto.includes('precio') || texto.includes('costo') || texto.includes('cuanto')) {
    msg.reply('Con gusto! ¿Qué producto te interesa? Mándame el nombre y te paso precio y disponibilidad.');
  } else if (texto.includes('pedido') || texto.includes('comprar') || texto.includes('quiero')) {
    msg.reply('Perfecto! Para tu pedido dime: \n1. Qué producto quieres\n2. Cuántos\n3. A dónde es la entrega');
  } else if (texto.includes('gracias')) {
    msg.reply('De nada! Aquí estamos para ayudarte 😊');
  }
});
