import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações do Micro-serviço
const HTTP_PORT = 8085;
const BACKEND_WEBHOOK_URL = process.env.WEBHOOK_TARGET_URL || 'http://127.0.0.1:8000/api/v1/webhooks/whatsapp';
const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET || 'webhook_secret_seguro_2026';
const INSTANCE_NAME = 'contabflow_instance';

let currentQR = null;
let currentQRDataUrl = null;
let isConnected = false;
let userPhone = null;
let sockInstance = null;
const sentMessagesMap = new Map();

// Prevenção contra crash em erros transitórios do WebSocket / Baileys
process.on('uncaughtException', (err) => {
  const msg = err?.message || String(err);
  if (msg.includes('Bad MAC')) {
    console.warn('[Bridge SafeGuard] ⚠️ Bad MAC detectado em sessão de contato. Limpando chaves de sessão desatualizadas...');
    const authFolder = path.join(__dirname, 'auth_info_baileys');
    try {
      const files = fs.readdirSync(authFolder);
      for (const f of files) {
        if (f.startsWith('session-')) {
          fs.unlinkSync(path.join(authFolder, f));
        }
      }
    } catch {}
    return;
  }
  console.warn('[Bridge SafeGuard] Exceção interceptada:', msg);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Bridge SafeGuard] Rejeição assíncrona interceptada:', reason?.message || reason);
});

// Logger silencioso para o Baileys
const logger = pino({ level: 'silent' });

async function startWhatsApp() {
  const authFolder = path.join(__dirname, 'auth_info_baileys');
  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      if (key?.id && sentMessagesMap.has(key.id)) {
        return sentMessagesMap.get(key.id);
      }
      return { conversation: '' };
    },
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      currentQRDataUrl = await QRCode.toDataURL(qr);
      console.log('\n======================================================');
      console.log('📱 ESCANEIE O QR CODE ABAIXO COM O SEU WHATSAPP:');
      console.log(`Ou abra no navegador: http://localhost:${HTTP_PORT}`);
      console.log('======================================================\n');
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      isConnected = false;
      userPhone = null;
      console.log(`[Bridge] Conexão fechada (${statusCode}). Reconectando...`);

      if (isLoggedOut) {
        console.log('[Bridge] ⚠️ Sessão deslogada/expirada no WhatsApp (401). Limpando credenciais antigas para novo pareamento...');
        try {
          if (fs.existsSync(authFolder)) {
            fs.rmSync(authFolder, { recursive: true, force: true });
          }
        } catch (e) {
          console.error('[Bridge] Erro ao limpar authFolder:', e.message);
        }
      }
      setTimeout(startWhatsApp, 3000);
    } else if (connection === 'open') {
      isConnected = true;
      currentQR = null;
      currentQRDataUrl = null;
      userPhone = sock.user?.id?.split(':')[0] || 'Conectado';
      console.log('\n======================================================');
      console.log(`🎉 WHATSAPP CONECTADO COM SUCESSO! (+${userPhone})`);
      console.log('O Bridge agora está repassando mensagens em tempo real para o ContabFlow.');
      console.log('======================================================\n');
    }
  });

  function unwrapMessage(rawMsg) {
    let m = rawMsg?.message || {};
    if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
    if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
    if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
    if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;
    if (m.editedMessage?.message?.protocolMessage?.editedMessage) m = m.editedMessage.message.protocolMessage.editedMessage;
    if (m.protocolMessage?.editedMessage) m = m.protocolMessage.editedMessage;
    return m;
  }

  function extractMessageText(m) {
    if (!m) return '';
    if (typeof m === 'string') return m;
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.documentMessage?.caption) return m.documentMessage.caption;
    if (m.buttonsResponseMessage?.selectedDisplayText) return m.buttonsResponseMessage.selectedDisplayText;
    if (m.buttonsResponseMessage?.selectedButtonId) return m.buttonsResponseMessage.selectedButtonId;
    if (m.templateButtonReplyMessage?.selectedDisplayText) return m.templateButtonReplyMessage.selectedDisplayText;
    if (m.templateButtonReplyMessage?.selectedId) return m.templateButtonReplyMessage.selectedId;
    if (m.listResponseMessage?.title) return m.listResponseMessage.title;
    if (m.listResponseMessage?.singleSelectReply?.selectedRowId) return m.listResponseMessage.singleSelectReply.selectedRowId;
    if (m.interactiveResponseMessage?.body?.text) return m.interactiveResponseMessage.body.text;
    if (m.reactionMessage?.text) return `[Reação: ${m.reactionMessage.text}]`;
    return '';
  }

  // Fila em memória para desacoplar eventos do Baileys e evitar travamento do WebSocket
  const incomingQueue = [];
  let isProcessingQueue = false;

  async function processQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (incomingQueue.length > 0) {
      const { msg } = incomingQueue.shift();
      try {
        const rawJid = msg.key?.remoteJid;
        if (!rawJid || rawJid.includes('@broadcast') || msg.key?.fromMe) {
          continue;
        }

        let remoteJid = msg.key?.senderPn || msg.key?.participant || rawJid;
        if (remoteJid.includes('@lid')) {
          remoteJid = msg.key?.senderPn || rawJid;
        }

        const m = unwrapMessage(msg);
        let messageType = 'conversation';
        if (m.documentMessage) messageType = 'documentMessage';
        else if (m.imageMessage) messageType = 'imageMessage';
        else if (m.audioMessage) messageType = 'audioMessage';
        else if (m.extendedTextMessage) messageType = 'extendedTextMessage';

        const extractedText = extractMessageText(m);
        const hasMedia = !!(m.documentMessage || m.imageMessage || m.audioMessage || m.videoMessage);

        // Se não possui texto e nem mídia (ex: protocolo de sessão, ACK, criptografia de chaves), não despacha lixo vazio
        if (!extractedText && !hasMedia) {
          console.log(`[Bridge Queue] ℹ️ Pacote sem texto/mídia de ${remoteJid}:`, JSON.stringify(msg.message || {}));
          continue;
        }

        const fileDesc = m.documentMessage?.fileName || (messageType === 'imageMessage' ? 'Foto/Imagem' : (extractedText || 'Texto'));
        console.log(`[Bridge Queue] 📩 Processando mensagem de ${remoteJid} | Tipo: ${messageType} (${fileDesc})`);

        // Download de mídias reais (PDF, XML, Imagem)
        let savedFilePath = null;
        if (m.documentMessage || m.imageMessage) {
          try {
            console.log('[Bridge Queue] 📥 Baixando anexo recebido via WhatsApp...');
            const buffer = await downloadMediaMessage(
              { key: msg.key, message: m },
              'buffer',
              {},
              { logger }
            );

            // Grava em subpasta temporária para permitir purga após extração
            const uploadDir = path.resolve(__dirname, '../backend/uploads/whatsapp/temp');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }

            const originalName = m.documentMessage?.fileName || (messageType === 'imageMessage' ? `foto_${Date.now()}.jpg` : `documento_${Date.now()}.pdf`);
            const cleanName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            savedFilePath = path.join(uploadDir, cleanName);

            fs.writeFileSync(savedFilePath, buffer);
            console.log(`[Bridge Queue] 💾 Arquivo salvo com sucesso em: ${savedFilePath} (${buffer.length} bytes)`);
          } catch (downloadErr) {
            console.error('[Bridge Queue] ❌ Erro ao baixar anexo de mídia:', downloadErr.message);
          }
        }

        const evolutionPayload = {
          event: 'messages.upsert',
          instance: INSTANCE_NAME,
          from: remoteJid,
          body: extractedText,
          mediaType: hasMedia ? (m.documentMessage ? 'DOCUMENTO' : m.imageMessage ? 'IMAGEM' : 'AUDIO') : 'TEXTO',
          mediaUrl: savedFilePath,
          fileName: m.documentMessage?.fileName || (m.imageMessage ? 'imagem.png' : null),
          messageId: msg.key?.id,
          data: {
            key: {
              remoteJid: remoteJid,
              fromMe: false,
              id: msg.key.id
            },
            pushName: msg.pushName || 'Cliente WhatsApp',
            messageType: messageType,
            message: m,
            text: extractedText,
            file_path: savedFilePath,
            media_url: savedFilePath,
            messageTimestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000)
          }
        };

        console.log(`[Bridge Queue] Despachando para Backend: ${BACKEND_WEBHOOK_URL} | Texto: "${extractedText}"`);
        const res = await fetch(BACKEND_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': WEBHOOK_SECRET
          },
          body: JSON.stringify(evolutionPayload)
        });

        const data = await res.json();
        console.log(`[Bridge Queue] ✅ Resposta do ContabFlow Backend (${res.status}):`, data);
      } catch (err) {
        console.error('[Bridge Queue] ❌ Erro no processamento da mensagem:', err.message);
      }
    }

    isProcessingQueue = false;
  }

  // Escuta mensagens recebidas no WhatsApp com despacho imediato para a fila
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      incomingQueue.push({ msg });
    }

    // Libera o loop de socket do Baileys imediatamente e agenda o consumo da fila
    setImmediate(processQueue);
  });

  sockInstance = sock;
  return sock;
}

// Servidor Web para visualização gráfica do QR Code e API Outbound
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
  const pathname = url.pathname;

  // 1. Endpoint JSON de Status (usado pelo frontend Next.js)
  if (pathname === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      isConnected,
      userPhone,
      hasQR: !!currentQR,
      qrDataUrl: currentQRDataUrl,
    }));
    return;
  }

  // 1.1 Reset manual de sessão
  if ((pathname === '/session/reset' || pathname === '/reset') && (req.method === 'POST' || req.method === 'GET')) {
    console.log('[Bridge] 🔄 Reset de sessão solicitado. Limpando credenciais...');
    const authFolder = path.join(__dirname, 'auth_info_baileys');
    isConnected = false;
    userPhone = null;
    currentQR = null;
    currentQRDataUrl = null;
    try {
      if (sockInstance) {
        sockInstance.end(new Error('Manual session reset'));
      }
      if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('[Bridge] Erro ao limpar sessão:', e.message);
    }
    setTimeout(startWhatsApp, 1500);
    if (req.headers['accept']?.includes('text/html')) {
      res.writeHead(302, { 'Location': '/' });
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Sessão reiniciada. Novo QR Code sendo gerado.' }));
    return;
  }

  // 2. Envio Real de Mensagens (Outbound - aceita /message/sendText e /send)
  if ((pathname.startsWith('/message/sendText') || pathname === '/send') && req.method === 'POST') {
    const authKey = req.headers['apikey'] || url.searchParams.get('apikey');
    if (authKey !== WEBHOOK_SECRET) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Acesso negado: chave apikey inválida.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const rawNumber = payload.number || payload.to || '';
        const messageText = payload.text || payload.textMessage?.text || payload.message || '';

        if (!rawNumber || !messageText) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Campos "number" e "text" são obrigatórios.' }));
          return;
        }

        if (!isConnected || !sockInstance) {
          console.warn(`[Bridge Outbound] Falha: WhatsApp não conectado para envio.`);
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'WhatsApp desconectado. Escaneie o QR Code em http://localhost:8085',
            isConnected: false
          }));
          return;
        }

        let digits = String(rawNumber).replace(/\D/g, '');
        if (digits.length === 10 || digits.length === 11) {
          digits = `55${digits}`;
        }

        let targetJid = `${digits}@s.whatsapp.net`;

        // 1. Resolução inteligente de JID no WhatsApp (Flexibilidade 9º dígito Brasil)
        if (sockInstance?.onWhatsApp) {
          try {
            console.log(`[Bridge Outbound] 🔍 Verificando número oficial no WhatsApp para: ${digits}...`);
            const results = await sockInstance.onWhatsApp(digits);
            if (results && results.length > 0 && results[0]?.exists) {
              targetJid = results[0].jid;
              console.log(`[Bridge Outbound] ✅ JID validado no WhatsApp: ${targetJid}`);
            } else if (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') {
              // Testa variação sem o 9º dígito (DDD + 8 dígitos)
              const semNove = digits.slice(0, 4) + digits.slice(5);
              console.log(`[Bridge Outbound] 🔍 Testando variação (8 dígitos): ${semNove}...`);
              const resultsSemNove = await sockInstance.onWhatsApp(semNove);
              if (resultsSemNove && resultsSemNove.length > 0 && resultsSemNove[0]?.exists) {
                targetJid = resultsSemNove[0].jid;
                console.log(`[Bridge Outbound] ✅ JID validado no WhatsApp (8 dígitos): ${targetJid}`);
              }
            } else if (digits.startsWith('55') && digits.length === 12) {
              // Testa variação com o 9º dígito (DDD + 9 + 8 dígitos)
              const comNove = digits.slice(0, 4) + '9' + digits.slice(4);
              console.log(`[Bridge Outbound] 🔍 Testando variação (9 dígitos): ${comNove}...`);
              const resultsComNove = await sockInstance.onWhatsApp(comNove);
              if (resultsComNove && resultsComNove.length > 0 && resultsComNove[0]?.exists) {
                targetJid = resultsComNove[0].jid;
                console.log(`[Bridge Outbound] ✅ JID validado no WhatsApp (9 dígitos): ${targetJid}`);
              }
            }
          } catch (onWaErr) {
            console.warn('[Bridge Outbound] ⚠️ Falha na verificação onWhatsApp, usando targetJid padrão:', onWaErr.message);
          }
        }

        console.log(`[Bridge Outbound] 📤 Enviando mensagem real via Baileys para ${targetJid}...`);
        const sent = await sockInstance.sendMessage(targetJid, { text: messageText });
        const messageId = sent?.key?.id || `sent_${Date.now()}`;
        if (sent?.message) {
          sentMessagesMap.set(messageId, sent.message);
        }

        console.log(`[Bridge Outbound] ✅ Mensagem entregue com sucesso para ${targetJid}! ID: ${messageId}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          key: { id: messageId },
          status: 'ENVIADO',
          to: targetJid,
          sentAt: new Date().toISOString()
        }));
      } catch (err) {
        console.error('[Bridge Outbound] ❌ Erro ao enviar mensagem:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3. Interface Web do QR Code
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  
  if (isConnected) {
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Bridge - Conectado</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #0f172a; padding: 2.5rem; border-radius: 1.5rem; text-align: center; border: 1px solid #1e293b; box-shadow: 0 20px 40px rgba(0,0,0,0.6); max-width: 440px; width: 90%; }
          .icon { font-size: 3rem; margin-bottom: 0.5rem; }
          h1 { color: #10b981; margin-bottom: 0.5rem; font-size: 1.5rem; font-weight: 700; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
          .phone { font-weight: bold; color: #38bdf8; font-family: monospace; font-size: 1.1rem; }
          .btn-reset { display: inline-block; margin-top: 1.5rem; background: #ef4444; color: white; border: none; padding: 0.7rem 1.4rem; border-radius: 0.75rem; font-size: 0.9rem; text-decoration: none; cursor: pointer; font-weight: 600; transition: 0.2s; }
          .btn-reset:hover { background: #dc2626; }
          .badge { display: inline-block; padding: 0.3rem 0.8rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 9999px; color: #34d399; font-size: 0.8rem; font-weight: 600; margin-top: 0.8rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>WhatsApp Conectado!</h1>
          <p>Número pareado com sucesso:<br><span class="phone">+${userPhone}</span></p>
          <div class="badge">● Bridge Ativo & Pronto</div>
          <p style="margin-top: 1.2rem; font-size: 0.85rem;">Todas as mensagens de clientes e notas fiscais serão sincronizadas automaticamente com o Cockpit 360° do ContabFlow.</p>
          <a href="/session/reset" class="btn-reset">Trocar Número / Desconectar</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (currentQRDataUrl) {
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Conectar WhatsApp - ContabFlow</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="6">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #0f172a; padding: 2.2rem; border-radius: 1.5rem; text-align: center; border: 1px solid #1e293b; box-shadow: 0 20px 40px rgba(0,0,0,0.6); max-width: 440px; width: 90%; }
          img { border-radius: 1rem; background: white; padding: 0.75rem; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
          h1 { font-size: 1.4rem; color: #38bdf8; margin-bottom: 0.5rem; font-weight: 700; }
          p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.2rem; line-height: 1.4; }
          ol { text-align: left; font-size: 0.85rem; color: #cbd5e1; margin-top: 1.2rem; padding-left: 1.4rem; line-height: 1.6; }
          li { margin-bottom: 0.4rem; }
          .refresh-hint { font-size: 0.75rem; color: #64748b; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Conectar ao ContabFlow</h1>
          <p>Escaneie o QR Code abaixo com seu WhatsApp físico para ativar a integração em tempo real:</p>
          <img src="${currentQRDataUrl}" width="280" height="280" alt="QR Code WhatsApp" />
          <ol>
            <li>Abra o <b>WhatsApp</b> no seu celular</li>
            <li>Acesse <b>Aparelhos Conectados</b></li>
            <li>Toque em <b>Conectar um aparelho</b> e aponte a câmera</li>
          </ol>
          <div class="refresh-hint">🔄 O QR Code atualiza automaticamente a cada 6 segundos</div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Iniciando WhatsApp Bridge</title>
      <meta http-equiv="refresh" content="3">
      <style>
        body { font-family: sans-serif; background: #090d16; color: #94a3b8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
        .card { background: #0f172a; padding: 2rem; border-radius: 1.2rem; border: 1px solid #1e293b; max-width: 400px; width: 90%; }
        .btn-action { display: inline-block; margin-top: 1rem; background: #10b981; color: white; padding: 0.6rem 1.2rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; font-size: 0.85rem; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2 style="color: #f8fafc; font-size: 1.2rem;">Iniciando sessão do WhatsApp...</h2>
        <p style="font-size: 0.9rem;">Aguarde alguns segundos enquanto geramos o QR Code.</p>
        <a href="/session/reset" class="btn-action">Gerar Novo QR Code Agora</a>
      </div>
    </body>
    </html>
  `);
});

server.listen(HTTP_PORT, () => {
  console.log(`\n======================================================`);
  console.log(`[Bridge Server] Servidor Web ativo em: http://localhost:${HTTP_PORT}`);
  console.log(`[Bridge Webhook Alvo]: ${BACKEND_WEBHOOK_URL}`);
  console.log(`======================================================\n`);
  startWhatsApp();
});
