const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot activo ✅'));
app.listen(PORT, () => console.log('Servidor en puerto ' + PORT));

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
            '--disable-gpu'
        ]
    }
});

// ===== CONFIG =====
const ADMIN = '5210000000000@c.us'; // <-- PON TU NUMERO AQUI CON 52 Y LADA, EJ: 527551234567
const PRECIO_MENSUAL = 50;
const PRECIO_ANUAL = 100;
const GRUPO_VIP = ''; // ID del grupo, se pone despues

let clientes = {}; // { numero: { vence: fecha, tipo: 'mensual' } }
let pendientes = {}; // { numero: { tipo, esperandoComprobante: true } }

function diasRestantes(numero){
    if(!clientes[numero]) return 0;
    let diff = new Date(clientes[numero].vence) - new Date();
    return Math.ceil(diff / (1000*60*60*24));
}

client.on('qr', (qr) => {
    console.log('ESCANEA ESTE CODIGO:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ BOT LISTO Y CONECTADO');
});

client.on('message', async (msg) => {
    try {
        if (msg.from === 'status@broadcast') return;
        const texto = msg.body.trim().toLowerCase();
        const numero = msg.from;
        const esGrupo = msg.from.endsWith('@g.us');
        if (esGrupo) return; // Solo responde en privado

        // ===== MENU =====
        if (texto === 'hola' || texto === 'menu' || texto === 'menú' || texto === '1') {
            let estado = '';
            if (clientes[numero]) {
                estado = `\n\n✅ *TU SUSCRIPCIÓN:* ${clientes[numero].tipo}\nTe quedan ${diasRestantes(numero)} días.`;
            }
            return msg.reply(`👋 *BIENVENIDO A VENTAS VIP*${estado}\n\nElige una opción:\n\n*1* - Ver planes 📦\n*2* - Comprar Mensual $${PRECIO_MENSUAL}\n*3* - Comprar Anual $${PRECIO_ANUAL} (AHORRAS!)\n*4* - Ya pagué, enviar comprobante 🧾\n*5* - Mi suscripción 📅\n*6* - Hablar con soporte 👨‍💻`);
        }

        if (texto === '2' || texto.includes('mensual')) {
            pendientes[numero] = { tipo: 'mensual', esperando: true };
            return msg.reply(`📦 *PLAN MENSUAL - $${PRECIO_MENSUAL}*\n\n✅ Acceso al grupo VIP por 30 días\n✅ Contenido exclusivo\n✅ Soporte\n\n*PARA PAGAR:*\n1. Transfiere $${PRECIO_MENSUAL} a:\nCLABE: *PON_TU_CLABE_AQUI*\nNombre: *PON_TU_NOMBRE*\nBanco: *PON_TU_BANCO*\n\n2. Después escribe *4* y manda tu comprobante 📸`);
        }

        if (texto === '3' || texto.includes('anual')) {
            pendientes[numero] = { tipo: 'anual', esperando: true };
            return msg.reply(`🔥 *PLAN ANUAL - $${PRECIO_ANUAL}*\n\n✅ Acceso al grupo VIP por 365 días\n✅ Te ahorras $500 vs mensual\n✅ Contenido exclusivo\n✅ Soporte prioritario\n\n*PARA PAGAR:*\n1. Transfiere $${PRECIO_ANUAL} a:\nCLABE: *PON_TU_CLABE_AQUI*\nNombre: *PON_TU_NOMBRE*\nBanco: *PON_TU_BANCO*\n\n2. Después escribe *4* y manda tu comprobante 📸`);
        }

        if (texto === '4' || texto.includes('pague') || texto.includes('comprobante')) {
            pendientes[numero] = { ...pendientes[numero], esperando: true };
            return msg.reply(`🧾 *ENVIA TU COMPROBANTE*\n\nManda aquí la foto o captura de tu transferencia.\n\nUn administrador lo revisará y te activará en unos minutos.`);
        }

        if (texto === '5' || texto.includes('suscrip')) {
            if (!clientes[numero]) return msg.reply(`❌ No tienes suscripción activa.\n\nEscribe *1* para ver los planes.`);
            return msg.reply(`📅 *TU SUSCRIPCIÓN*\n\nPlan: ${clientes[numero].tipo}\nVence: ${clientes[numero].vence}\nTe quedan: ${diasRestantes(numero)} días`);
        }

        if (texto === '6' || texto.includes('soporte') || texto.includes('ayuda')) {
            return msg.reply(`👨‍💻 *SOPORTE*\n\nEscribe tu duda y un administrador te contestará.\n\nO escribe directamente al admin.`);
        }

        // ===== SI MANDA FOTO Y ESTA PENDIENTE =====
        if (msg.hasMedia && pendientes[numero]?.esperando) {
            const media = await msg.downloadMedia();
            await client.sendMessage(ADMIN, `🔔 *NUEVO PAGO PENDIENTE*\n\nDe: ${numero}\nPlan: ${pendientes[numero].tipo || 'no especificado'}\n\nRevisa el comprobante y responde:\n*APROBAR ${numero}*\npara activarlo.\n\n*RECHAZAR ${numero}* para rechazarlo.`);
            await client.sendMessage(ADMIN, media, { caption: `Comprobante de ${numero}` });
            return msg.reply(`✅ *COMPROBANTE RECIBIDO*\n\nYa lo mandamos a revisión. Te avisamos en cuanto te activen.\n\nNo vuelvas a mandar el comprobante, porfa.`);
        }

        // ===== COMANDOS ADMIN =====
        if (numero === ADMIN) {
            if (texto.startsWith('aprobar')) {
                let numCliente = texto.replace('aprobar','').trim() + '@c.us';
                // Si viene con @, limpiarlo
                numCliente = numCliente.replace('@c.us@c.us','@c.us');
                let tipo = pendientes[numCliente]?.tipo || 'mensual';
                let dias = tipo === 'anual' ? 365 : 30;
                let vence = new Date();
                vence.setDate(vence.getDate() + dias);
                clientes[numCliente] = { tipo, vence: vence.toLocaleDateString('es-MX') };
                delete pendientes[numCliente];
                await client.sendMessage(numCliente, `🎉 *¡PAGO APROBADO!*\n\nTu plan *${tipo}* ya está activo.\nVence: ${vence.toLocaleDateString('es-MX')}\n\nBienvenido al VIP 🔥`);
                return msg.reply(`✅ Cliente ${numCliente} activado por ${dias} días.`);
            }
            if (texto.startsWith('rechazar')) {
                let numCliente = texto.replace('rechazar','').trim() + '@c.us';
                delete pendientes[numCliente];
                await client.sendMessage(numCliente, `❌ Tu comprobante no se pudo validar.\n\nManda bien la captura o contacta a soporte.`);
                return msg.reply(`❌ Rechazado.`);
            }
            if (texto === 'clientes') {
                let lista = '📋 *CLIENTES ACTIVOS:*\n\n';
                for (let k in clientes) lista += `${k} - ${clientes[k].tipo} - vence ${clientes[k].vence}\n`;
                return msg.reply(lista || 'No hay clientes');
            }
        }

    } catch (e) {
        console.log('Error en mensaje:', e.message);
    }
});

// ===== REVISAR VENCIMIENTOS CADA HORA =====
setInterval(async () => {
    for (let numero in clientes) {
        let dias = diasRestantes(numero);
        if (dias === 3) {
            try { await client.sendMessage(numero, `⚠️ *TU SUSCRIPCIÓN VENCE EN 3 DÍAS*\n\nRenueva ahora escribiendo *1* para no perder tu acceso.`); } catch(e){}
        }
        if (dias <= 0) {
            try {
                await client.sendMessage(numero, `❌ *TU SUSCRIPCIÓN VENCIÓ*\n\nEscribe *1* para renovar y seguir en el VIP.`);
                // Intentar sacarlo del grupo si hay ID
                if (GRUPO_VIP) {
                    try { await client.removeParticipants(GRUPO_VIP, [numero]); } catch(e){}
                }
                delete clientes[numero];
            } catch(e){}
        }
    }
}, 1000 * 60 * 60);

client.initialize();
