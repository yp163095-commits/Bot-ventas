const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const app = express();
app.use(express.json());

const ADMIN = '527321134837@c.us';
const NUMERO_PARA_VINCULAR = '527321134837';

const PRECIO_MENSUAL = 50;
const PRECIO_ANUAL = 100;
const PRECIO_MENSUAL_TEXTO = '$50 MXN';
const PRECIO_ANUAL_TEXTO = '$100 MXN';

const PRODUCTOS = {
  netflix: { nombre: 'Netflix - Perfil 4K', precio: 89, duracion: 30 },
  disney: { nombre: 'Disney+ - Perfil', precio: 79, duracion: 30 },
  max: { nombre: 'Max - Perfil', precio: 79, duracion: 30 },
  prime: { nombre: 'Prime Video - Perfil', precio: 59, duracion: 30 },
  spotify: { nombre: 'Spotify - Cuenta', precio: 59, duracion: 30 },
  vix: { nombre: 'ViX Premium', precio: 49, duracion: 30 },
  combo: { nombre: 'Combo Netflix + Disney', precio: 139, duracion: 30 },
};

const PAGOS = `💳 *¿CÓMO PAGAR?*
Transferencia: 1234 5678 9012 3456 - Banco AZTECA - Ramiro I.
OXXO: 1234 5678 9012 3456
PayPal: tu-paypal@correo.com

Después manda: *Folio 12345*`;

let pedidos = [];
let cuentas = { netflix: [], disney: [], max: [], prime: [], spotify: [], vix: [], combo: [] };
let bloqueados = new Set();
let totalVendidoHoy = 0;
let licencias = { '527321134837': { vence: Date.now() + 365 * 86400000, tipo: 'DUEÑO - ANUAL', nombre: 'Ramiro' } };

let palabrasRobo = [
  'yo vendo', 'mas barato', 'más barato', 'te lo dejo en', 'te lo vendo',
  'mandame whats', 'mándame whats', 'mi numero es', 'mi número es',
  'vendo cuentas', 'tengo mas barato', 'yo tengo', 'aqui mas barato',
  'wa.me/', 't.me/', 'contactame', 'contáctame', 'escribeme'
];

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('ready', () => console.log('BOT PRENDIDO'));
client.on('code', (codigo) => console.log('TU CODIGO: ' + codigo));
client.on('auth_failure', () => console.log('Fallo auth'));
client.on('disconnected', () => console.log('Desconectado'));

function menu() {
  let txt = `⚡ *STREAMING SHOP - MENÚ*\n\n`;
  let i = 1;
  for (let k in PRODUCTOS) { txt += `${i}️⃣ ${PRODUCTOS[k].nombre} - $${PRODUCTOS[k].precio} MXN\n`; i++; }
  txt += `\n*Catalogo* - Ver todo\n*Comprar Netflix* - Comprar\n*Pagar* - Cómo pagar\n*Mis cuentas* - Ver mis cuentas\n*Garantia* - Si te falla\n*Soporte* - Hablar conmigo`;
  return txt;
}

function catalogo() {
  let txt = `📺 *CATÁLOGO*\n\n`;
  for (let k in PRODUCTOS) {
    let stock = (cuentas[k] || []).filter(c => !c.vendido).length;
    txt += `✅ ${PRODUCTOS[k].nombre}\n💰 $${PRODUCTOS[k].precio} MXN - ${PRODUCTOS[k].duracion} días - Stock: ${stock}\n\n`;
  }
  txt += `Para comprar escribe: *Comprar Netflix*`;
  return txt;
}

client.on('message', async msg => {
  try {
    if (msg.from === 'status@broadcast') return;
    let textoRaw = (msg.body || '').trim();
    let texto = textoRaw.toLowerCase();
    let numero = msg.from;
    let esAdmin = numero === ADMIN;
    let nombreCliente = msg._data.notifyName || 'Cliente';

    if (bloqueados.has(numero) && !esAdmin) return;

    let chat = null;
    try { chat = await msg.getChat(); } catch (e) {}
    if (chat && chat.isGroup && !esAdmin) {
      let sospechoso = palabrasRobo.some(p => texto.includes(p));
      let mandaOtroNumero = texto.includes('wa.me/') && !texto.includes('527321134837') && !texto.includes('7321134837');
      let mandaOtroLink = texto.includes('t.me/') || texto.includes('bit.ly');
      if (sospechoso || mandaOtroNumero || mandaOtroLink) {
        await client.sendMessage(ADMIN, `🚨 *ALERTA ROBO DE CLIENTE*\n\nGrupo: ${chat.name}\nQuién: ${nombreCliente} - ${numero}\nDijo: ${msg.body}\n\n*Sacar ${numero.replace('@c.us', '')}*\n*Bloquear ${numero.replace('@c.us', '')}*`);
      }
    }

    if (['hola', 'menu', 'menú', 'inicio', 'start', 'buenas', 'buenas tardes', 'buenas noches'].includes(texto)) return msg.reply(menu());
    if (texto === 'catalogo' || texto === 'catálogo' || texto === '1') return msg.reply(catalogo());
    if (texto === 'pagar') return msg.reply(PAGOS);
    if (texto === 'soporte') {
      await client.sendMessage(ADMIN, `🆘 *SOPORTE*\nCliente: ${nombreCliente} - ${numero}\nQuiere hablar contigo`);
      return msg.reply('✅ Ya le avisé al admin. WhatsApp: 732 113 4837');
    }
    if (texto === 'mis cuentas') {
      let mis = pedidos.filter(p => p.telefono === numero && p.estado === 'Entregado');
      if (!mis.length) return msg.reply('Aún no tienes cuentas. Escribe *Catalogo*');
      let t = `📦 *TUS CUENTAS*\n\n`;
      mis.forEach(p => t += `${p.producto}\n${p.datos || ''}\n\n`);
      return msg.reply(t);
    }
    if (texto === 'garantia' || texto === 'garantía') {
      await client.sendMessage(ADMIN, `🛡️ *GARANTIA*\nCliente: ${nombreCliente} - ${numero}\nDice que le falla su cuenta`);
      return msg.reply('✅ Reporte creado. Manda foto/video de lo que te sale.');
    }
    if (texto === 'renovar') return msg.reply('⏳ Para renovar escribe *Comprar* + nombre. Ej: *Comprar Netflix*');
    if (texto.startsWith('comprar')) {
      let clave = texto.replace('comprar', '').trim();
      let keys = Object.keys(PRODUCTOS);
      let encontrado = keys.find(k => k === clave || PRODUCTOS[k].nombre.toLowerCase().includes(clave));
      if (!encontrado) return msg.reply('¿Cuál quieres?\n*Comprar Netflix*\n*Comprar Disney*\n*Comprar Max*\n*Comprar Spotify*\n*Comprar Combo*');
      let p = PRODUCTOS[encontrado];
      let id = Date.now();
      pedidos.push({ id, cliente: nombreCliente, telefono: numero, producto: p.nombre, precio: p.precio, clave: encontrado, estado: 'Esperando Pago' });
      return msg.reply(`🛒 *${p.nombre}*\n💰 $${p.precio} MXN - ${p.duracion} días\n\n${PAGOS}\n\nTu pedido es #${id}\nDespués de pagar manda: *Folio 12345*`);
    }
    if (texto.startsWith('folio')) {
      let folio = textoRaw.split(' ').slice(1).join(' ');
      let ped = [...pedidos].reverse().find(p => p.telefono === numero && p.estado === 'Esperando Pago');
      if (!ped) return msg.reply('No tienes pedido pendiente. Escribe *Comprar Netflix* primero.');
      ped.folio = folio; ped.estado = 'Pendiente Aprobación';
      await client.sendMessage(ADMIN, `💰 *NUEVO PAGO*\nCliente: ${ped.cliente} - ${numero}\nProducto: ${ped.producto}\nPrecio: $${ped.precio}\nFolio: ${folio}\nPedido #${ped.id}\n\nPara aprobar: *Aprobar ${ped.id}*`);
      return msg.reply(`✅ Folio recibido: ${folio}\n⏳ Reviso tu pago y te mando tu cuenta.`);
    }

    if (!esAdmin) return;

    if (texto.startsWith('agregar stock') || texto.startsWith('agregar')) {
      let p = textoRaw.split(' ');
      let inicio = p[1].toLowerCase() === 'stock' ? 2 : 1;
      let clave = (p[inicio] || '').toLowerCase();
      let correo = p[inicio + 1]; let pass = p[inicio + 2]; let perfil = p[inicio + 3] || 'Perfil 1'; let pin = p[inicio + 4] || '0000';
      if (!PRODUCTOS[clave]) return msg.reply('Ese producto no existe. Usa: Netflix, Disney, Max, Prime, Spotify, Vix, Combo');
      if (!correo || !pass) return msg.reply('Falta correo o pass. Ej:\n*Agregar stock Netflix correo@gmail.com 12345 Perfil1 1234*');
      if (!cuentas[clave]) cuentas[clave] = [];
      cuentas[clave].push({ correo, pass, perfil, pin, vendido: false });
      return msg.reply(`✅ *STOCK AGREGADO*\nProducto: ${PRODUCTOS[clave].nombre}\nCorreo: ${correo}\nPerfil: ${perfil} - PIN: ${pin}\nAhora tienes: ${cuentas[clave].filter(c => !c.vendido).length} disponibles`);
    }
    if (texto === 'stock') {
      let t = `📦 *STOCK ACTUAL*\n\n`;
      for (let k in PRODUCTOS) t += `${PRODUCTOS[k].nombre}: ${(cuentas[k] || []).filter(c => !c.vendido).length} disponibles\n`;
      t += `\nPara agregar:\n*Agregar stock Netflix correo pass Perfil1 1234*`;
      return msg.reply(t);
    }
    if (texto === 'ventas hoy') return msg.reply(`💰 *VENTAS HOY*\nPedidos: ${pedidos.filter(p => p.estado === 'Entregado').length}\nVendido hoy: $${totalVendidoHoy} MXN\nTotal pedidos: ${pedidos.length}`);

    if (texto.startsWith('aprobar')) {
      let id = texto.replace('aprobar', '').trim();
      let ped = pedidos.find(p => String(p.id) === id);
      if (!ped) return msg.reply('No encontré pedido #' + id);
      let stock = (cuentas[ped.clave] || []).find(c => !c.vendido);
      if (!stock) return msg.reply('⛔ Sin stock de ' + ped.producto + '. Agrega con:\n*Agregar stock ' + ped.clave + ' correo pass Perfil1 1234*');
      stock.vendido = true;
      ped.estado = 'Entregado';
      ped.datos = `Correo: ${stock.correo}\nContraseña: ${stock.pass}\nPerfil: ${stock.perfil}\nPIN: ${stock.pin}`;
      totalVendidoHoy += Number(ped.precio || 0);
      await client.sendMessage(ped.telefono, `✅ *PAGO APROBADO*\n\nTu ${ped.producto} ya quedó:\n\n${ped.datos}\n\n⏳ Vence en 30 días. Si falla escribe *Garantia*`);
      return msg.reply('✅ Entregado a ' + ped.cliente);
    }
    if (texto.startsWith('rechazar')) {
      let id = texto.replace('rechazar', '').trim();
      let ped = pedidos.find(p => String(p.id) === id);
      if (ped) { ped.estado = 'Rechazado'; await client.sendMessage(ped.telefono, '❌ Tu pago no se pudo verificar. Manda foto del comprobante o escribe *Soporte*'); }
      return msg.reply('❌ Rechazado #' + id);
    }

    if (texto.startsWith('bloquear')) {
      let num = texto.replace('bloquear', '').trim().replace(/\D/g, '') + '@c.us';
      bloqueados.add(num);
      return msg.reply('🚫 *BLOQUEADO*\n' + num);
    }
    if (texto.startsWith('desbloquear')) {
      let num = texto.replace('desbloquear', '').trim().replace(/\D/g, '') + '@c.us';
      bloqueados.delete(num);
      return msg.reply('✅ Desbloqueado: ' + num);
    }
    if (texto === 'bloqueados') {
      if (!bloqueados.size) return msg.reply('Ninguno bloqueado');
      return msg.reply('🚫 *BLOQUEADOS*\n' + [...bloqueados].join('\n'));
    }

    if (texto.startsWith('sacar')) {
      let num = texto.replace('sacar', '').trim().replace(/\D/g, '') + '@c.us';
      let chatActual = await msg.getChat();
      if (!chatActual.isGroup) return msg.reply('Este comando solo funciona dentro del grupo. Entra al grupo y escribe *Sacar 52733xxxx*');
      try {
        await chatActual.removeParticipants([num]);
        bloqueados.add(num);
        return msg.reply('✅ Sacado del grupo y bloqueado: ' + num);
      } catch (e) { return msg.reply('❌ No pude sacarlo. ¿El bot es admin del grupo? Haz admin al bot.'); }
    }

    if (texto.startsWith('activar')) {
      let p = textoRaw.split(' ');
      let num = p[1].replace(/\D/g, '');
      let dias = parseInt(p[2]) || 30;
      let tipo = dias >= 365 ? 'ANUAL' : 'MENSUAL';
      let precioTexto = tipo === 'ANUAL' ? PRECIO_ANUAL_TEXTO : PRECIO_MENSUAL_TEXTO;
      licencias[num] = { vence: Date.now() + dias * 86400000, tipo, nombre: 'Cliente' };
      try { await client.sendMessage(num + '@c.us', `✅ *BOT ACTIVADO*\nPlan: ${tipo} - ${precioTexto}\nVence en ${dias} días\nGracias por rentar con Streaming Shop - Ramiro`); } catch (e) {}
      return msg.reply(`✅ *ACTIVADO*\nNúmero: ${num}\nPlan: ${tipo} - ${precioTexto}\nVence en ${dias} días`);
    }
    if (texto === 'vencimientos' || texto === 'rentas') {
      let t = `📅 *VENCIMIENTOS RENTAS*\n\n`;
      for (let k in licencias) {
        let d = Math.ceil((licencias[k].vence - Date.now()) / 86400000);
        t += `${k} - ${licencias[k].tipo} - ${d <= 0 ? '❌ VENCIDO' : 'Vence en ' + d + ' días'}\n`;
      }
      t += `\nPrecios:\nMensual: ${PRECIO_MENSUAL_TEXTO}\nAnual: ${PRECIO_ANUAL_TEXTO}`;
      return msg.reply(t);
    }
    if (texto.startsWith('desactivar')) {
      let num = texto.replace('desactivar', '').trim().replace(/\D/g, '');
      delete licencias[num];
      return msg.reply('❌ Desactivado: ' + num);
    }
    if (texto === 'ayuda' || texto === 'comandos') {
      return msg.reply(`🤖 *COMANDOS ADMIN*\n\nAgregar stock Netflix correo pass Perfil1 1234\nStock\nAprobar 123456\nRechazar 123456\nVentas hoy\nBloquear 52733xxxx\nDesbloquear 52733xxxx\nBloqueados\nSacar 52733xxxx\nActivar 52733xxxx 30 dias\nActivar 52733xxxx 365 dias\nVencimientos\nDesactivar 52733xxxx`);
    }

  } catch (e) { console.log('Error:', e.message); }
});

app.post('/aviso', async (req, res) => { try { await client.sendMessage(ADMIN, `📢 ${req.body.titulo}\n${req.body.mensaje}`); res.json({ ok: true }); } catch (e) { res.json({ ok: false }); } });
app.get('/', (req, res) => res.send('Bot de ventas prendido'));
app.listen(3000, () => console.log('Servidor en 3000'));

client.initialize();

setTimeout(async () => {
  try {
    if (!client.info) {
      const codigo = await client.requestPairingCode(NUMERO_PARA_VINCULAR);
      console.log('TU CODIGO: ' + codigo);
    }
  } catch (e) { console.log('Esperando vincular por codigo...'); }
}, 5000);
