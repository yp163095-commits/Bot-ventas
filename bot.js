const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino')

const MI_NUMERO = '5217321134837'
let codigoPedido = false

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Bot Ventas', 'Chrome', '1.0.0'],
        syncFullHistory: false
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        // AQUI es donde ya se pide el codigo, cuando ya esta conectando
        if (!sock.authState.creds.registered && !codigoPedido) {
            codigoPedido = true
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(MI_NUMERO)
                    console.log('======================================')
                    console.log('CODIGO DE 8:', code)
                    console.log('LARGO:', code.length)
                    console.log('METELO TODO PEGADO SIN GUION')
                    console.log('======================================')
                } catch (e) {
                    console.log('Error pidiendo codigo:', e.message)
                    codigoPedido = false
                }
            }, 3000)
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Conexion cerrada, reconectando:', shouldReconnect)
            if (shouldReconnect) {
                codigoPedido = false
                start()
            }
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO CON EXITO')
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const texto = (m.message.conversation || m.message.extendedTextMessage?.text || '').toLowerCase().trim()
        let respuesta = ''
        if (texto === 'hola' || texto === 'menu' || texto === 'inicio') {
            respuesta = `👋 Hola, bienvenido a Bot Ventas\n\n1️⃣ Ver productos\n2️⃣ Precios\n3️⃣ Hablar con vendedor\n\nEscribe el numero de la opcion`
        } else if (texto === '1') {
            respuesta = `📦 *PRODUCTOS:*\n- Producto 1\n- Producto 2\n- Producto 3`
        } else if (texto === '2') {
            respuesta = `💲 *PRECIOS:*\n- Producto 1: $100\n- Producto 2: $200`
        } else if (texto === '3') {
            respuesta = `👨‍💼 Te paso con un vendedor en un momento.`
        } else {
            respuesta = `No te entendi 😅 escribe *hola* para ver el menu`
        }
        await sock.sendMessage(from, { text: respuesta })
    })
}

start()
