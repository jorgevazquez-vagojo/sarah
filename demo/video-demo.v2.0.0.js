// ════════════════════════════════════════════
// RDGBot - Video Demo v2.0.0
// ════════════════════════════════════════════

let demoRunning = false;

const $ = id => document.getElementById(id);
const fab = $('fab');
const panel = $('widget-panel');
const welcomeView = $('welcome-view');
const chatView = $('chat-view');
const chatMessages = $('chat-messages');
const chatInput = $('chat-input-field');
const chatInputBar = $('chat-input-bar');
const callPanel = $('call-panel');
const dashOverlay = $('dashboard-overlay');
const startOverlay = $('start-overlay');
const subtitleBar = $('subtitle-bar');
const sceneIndicator = $('scene-indicator');
const cursor = $('demo-cursor');
const wCallBtn = $('w-call-btn');

// ── TTS ──
let ttsVoice = null;
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  const prefs = ['Microsoft Helena','Microsoft Laura','Microsoft Pablo','Microsoft Elvira','Microsoft Sabina','Helena','Laura','Pablo','Elvira'];
  for (const pref of prefs) {
    const v = voices.find(v => v.name.includes(pref) && v.lang.startsWith('es'));
    if (v) { ttsVoice = v; break; }
  }
  if (!ttsVoice) ttsVoice = voices.find(v => v.lang.startsWith('es')) || voices[0];
}
if (speechSynthesis) { speechSynthesis.onvoiceschanged = loadVoices; loadVoices(); }

function speak(text) {
  return new Promise(resolve => {
    if (!speechSynthesis || !text) { resolve(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (ttsVoice) u.voice = ttsVoice;
    u.lang = 'es-ES'; u.rate = 0.93; u.pitch = 1; u.volume = 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

function showSubtitle(text) { subtitleBar.textContent = text; subtitleBar.classList.add('visible'); }
function hideSubtitle() { subtitleBar.classList.remove('visible'); }
function showSceneLabel(text) { sceneIndicator.textContent = text; sceneIndicator.classList.add('visible'); }
function hideSceneLabel() { sceneIndicator.classList.remove('visible'); }

// ── Cursor ──
function moveCursor(x, y) { cursor.style.left = x+'px'; cursor.style.top = y+'px'; cursor.classList.add('visible'); }
function clickCursor() { cursor.classList.add('click'); setTimeout(() => cursor.classList.remove('click'), 300); }
function hideCursor() { cursor.classList.remove('visible'); }

// ── Widget ──
function openWidget() { fab.classList.add('open'); panel.classList.add('open'); }
function closeWidget() { fab.classList.remove('open'); panel.classList.remove('open'); }
function showChat() { welcomeView.style.display = 'none'; chatView.style.display = 'flex'; callPanel.style.display = 'none'; }
function showWelcome() { welcomeView.style.display = 'flex'; chatView.style.display = 'none'; callPanel.style.display = 'none'; }
function showCallView() { chatView.style.display = 'none'; welcomeView.style.display = 'none'; callPanel.style.display = 'flex'; }
function clearChat() { chatMessages.innerHTML = ''; }

function addBotMsg(html) { const d = document.createElement('div'); d.className = 'msg msg-bot'; d.innerHTML = `<div class="avatar">✦</div><div class="bubble">${html}</div>`; chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight; return d; }
function addUserMsg(text) { const d = document.createElement('div'); d.className = 'msg msg-user'; d.innerHTML = `<div class="bubble">${text}</div>`; chatMessages.appendChild(d); const t = document.createElement('div'); t.className = 'msg-time right'; t.textContent = new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+' \u2713\u2713'; chatMessages.appendChild(t); chatMessages.scrollTop = chatMessages.scrollHeight; }
function addSystemMsg(text) { const d = document.createElement('div'); d.className = 'msg msg-system'; d.textContent = text; chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight; }
function addTyping() { const d = document.createElement('div'); d.className = 'typing-indicator'; d.id = 'typing'; d.innerHTML = '<span></span><span></span><span></span>'; chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight; }
function removeTyping() { $('typing')?.remove(); }
function addQR(replies) { const r = document.createElement('div'); r.className = 'qr-row'; replies.forEach(t => { const c = document.createElement('span'); c.className = 'qr-chip'; c.textContent = t; r.appendChild(c); }); chatMessages.appendChild(r); chatMessages.scrollTop = chatMessages.scrollHeight; return r; }
function addCard(title, sub, color, btns) { const c = document.createElement('div'); c.className = 'rich-card'; c.innerHTML = `<div class="card-img" style="background:linear-gradient(135deg,${color},${color}cc)">📈</div><div class="card-body"><div class="card-title">${title}</div><div class="card-sub">${sub}</div><div class="card-btns">${btns.map(b=>`<span class="qr-chip" style="font-size:11px;padding:5px 12px">${b}</span>`).join('')}</div></div>`; chatMessages.appendChild(c); chatMessages.scrollTop = chatMessages.scrollHeight; }
function addFile(name, size, type) { const d = document.createElement('div'); d.className = 'file-attach'; d.style.alignSelf = 'flex-end'; d.innerHTML = `<div class="file-icon" style="background:#DBEAFE;color:var(--blue)">${type}</div><div class="file-info"><div class="file-name">${name}</div><div class="file-size">${size}</div></div>`; chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight; }
function addLeadForm() { const d = document.createElement('div'); d.className = 'lead-form-inline'; d.innerHTML = `<h4>📋 Solicitar informacion</h4><div class="lf-sub">Dejanos tus datos y un experto te contactara.</div><input type="text" id="lf-name" placeholder="Nombre *" readonly><input type="text" id="lf-email" placeholder="Email *" readonly><input type="text" id="lf-phone" placeholder="Telefono (opcional)" readonly><input type="text" id="lf-company" placeholder="Empresa" readonly><button class="lf-btn">Enviar solicitud</button>`; chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight; }
function addCSAT() { const d = document.createElement('div'); d.className = 'csat-box'; d.innerHTML = `<h4>Como calificarias tu experiencia?</h4><div class="csat-stars"><span class="csat-star">⭐</span><span class="csat-star">⭐</span><span class="csat-star">⭐</span><span class="csat-star">⭐</span><span class="csat-star">⭐</span></div>`; chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight; }
function fillCSAT(n) { document.querySelectorAll('.csat-star').forEach((s,i) => { if(i<n) s.classList.add('active'); }); }

function addCallCTA(dept, sub) {
  const d = document.createElement('div');
  d.className = 'call-cta';
  d.id = 'call-cta-btn';
  d.innerHTML = `<div class="call-cta-icon"><span class="phone-anim">📞</span></div><div class="call-cta-text"><div class="call-cta-title">☎ Llamar ahora</div><div class="call-cta-sub">${dept||'Habla con un experto de Boostic'}</div><div class="call-cta-free">${sub||'Llamada gratuita via WebRTC'}</div></div>`;
  chatMessages.appendChild(d);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return d;
}

function typeText(el, text, speed = 30) { return new Promise(resolve => { let i = 0; el.value = ''; const iv = setInterval(() => { if (i < text.length) { el.value += text[i]; i++; } else { clearInterval(iv); resolve(); } }, speed); }); }
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Dashboard ──
function showDashboard() { dashOverlay.classList.add('visible'); }
function hideDashboard() { dashOverlay.classList.remove('visible'); }
function addDashConv(id, name, preview, color, badge, badgeColor, time) { const l = $('do-conv-list'); const d = document.createElement('div'); d.className = 'do-conv'; d.id = `do-conv-${id}`; d.innerHTML = `<div class="do-avatar" style="background:linear-gradient(135deg,${color},${color}cc)">${name.split(' ').map(w=>w[0]).join('')}</div><div class="do-info"><div class="do-name">${name}</div><div class="do-preview">${preview}</div></div><div class="do-badge" style="background:${badgeColor}22;color:${badgeColor}">${badge}</div><div class="do-time">${time}</div>`; l.appendChild(d); }
function addDashMsg(type, text) { const m = $('do-messages'); const d = document.createElement('div'); if (type === 'note') { d.className = 'do-msg-note'; d.innerHTML = `📝 ${text}`; } else { d.className = `do-msg ${type}`; const ac = type === 'visitor' ? 'background:rgba(255,255,255,0.08);color:#94A3B8' : 'background:var(--red);color:white'; const lb = type === 'visitor' ? 'V' : 'A'; d.innerHTML = `<div class="do-msg-avatar" style="${ac}">${lb}</div><div class="do-msg-bubble">${text}</div>`; } m.appendChild(d); m.scrollTop = m.scrollHeight; }
function showAISummary(text) { $('ai-summary-text').innerHTML = text; $('ai-summary').style.display = 'flex'; }

// ════════════════════════════════════════════
// SCENES
// ════════════════════════════════════════════

const scenes = [
  // 0 - Intro
  { label: '1/16 · Introduccion', run: async () => {
    closeWidget(); showWelcome(); clearChat(); hideDashboard(); hideCursor();
    const site = $('redegal-site'); site.scrollTop = 0;
    showSubtitle('Bienvenidos a la demo del chatbot de Redegal');
    await speak('Bienvenidos a la demo completa del chatbot de Redegal. Estamos en la web real de redegal punto com. Vamos a recorrer todas las funcionalidades del widget: chat con inteligencia artificial, click to call con VoIP, captacion de leads, dashboard de agentes y mucho mas.');
    hideSubtitle();
    site.scrollTo({top:300,behavior:'smooth'}); await wait(1500);
    site.scrollTo({top:0,behavior:'smooth'}); await wait(1000);
  }},

  // 1 - Open widget
  { label: '2/16 · Abrir widget', run: async () => {
    const r = fab.getBoundingClientRect(); moveCursor(r.left+20,r.top+20); await wait(600);
    showSubtitle('El visitante hace clic en el boton flotante');
    await speak('El visitante hace clic en el boton flotante rojo de la esquina inferior derecha. Se abre el widget con la pantalla de bienvenida, que muestra las cuatro lineas de negocio de Redegal.');
    clickCursor(); await wait(200); openWidget(); await wait(1000); hideCursor(); hideSubtitle();
  }},

  // 2 - Select business line
  { label: '3/16 · Linea de negocio', run: async () => {
    const bl = document.querySelector('[data-line="boostic"]');
    const r = bl.getBoundingClientRect(); moveCursor(r.left+30,r.top+20); await wait(500);
    showSubtitle('Selecciona SEO & Growth (Boostic)');
    clickCursor(); bl.classList.add('selected'); await wait(400);
    hideCursor(); showChat();
    await speak('El visitante selecciona SEO y Growth, la linea Boostic. Se abre el chat y la inteligencia artificial saluda con conocimiento especifico de esa linea de negocio.');
    addBotMsg('Hola! Bienvenido al equipo <strong>Boostic</strong> de Redegal. Somos especialistas en SEO, Growth y analitica para e-commerce. En que puedo ayudarte?');
    await wait(400); addQR(['Auditoria SEO','Estrategia de contenidos','Hablar con un experto','Llamar']);
    hideSubtitle();
  }},

  // 3 - Chat conversation
  { label: '4/16 · Chat con IA', run: async () => {
    showSubtitle('Conversacion con inteligencia artificial');
    await typeText(chatInput, 'Tengo una tienda online y quiero mejorar mi SEO');
    await wait(300); addUserMsg('Tengo una tienda online y quiero mejorar mi SEO'); chatInput.value = '';
    await speak('El visitante escribe su consulta. El sistema detecta automaticamente el espanol y la IA responde con informacion especifica de los servicios SEO de Redegal, incluyendo casos de exito reales.');
    addTyping(); await wait(1500); removeTyping();
    addBotMsg('Perfecto! En <strong>Boostic</strong> tenemos amplia experiencia en SEO para e-commerce. Nuestro enfoque incluye:<br><br>&#x2022; <strong>Auditoria tecnica</strong> completa<br>&#x2022; <strong>Estrategia de keywords</strong> orientada a conversion<br>&#x2022; <strong>Optimizacion de fichas de producto</strong><br>&#x2022; <strong>Link building</strong> de calidad<br><br>Hemos conseguido +340% de trafico organico para Mango.');
    hideSubtitle();
  }},

  // 4 - Rich messages
  { label: '5/16 · Mensajes enriquecidos', run: async () => {
    showSubtitle('Tarjetas y respuestas rapidas');
    await wait(300);
    addBotMsg('Te muestro nuestro caso de exito mas destacado:');
    await speak('El bot envia mensajes enriquecidos: tarjetas con imagenes, botones de accion y respuestas rapidas. El visitante puede ver detalles del caso de exito o contactar directamente.');
    await wait(300); addCard('Caso de Exito: Mango', '+340% trafico organico en 6 meses', '#3B82F6', ['Ver detalles','Contactar']);
    await wait(400); addQR(['Quiero una auditoria','Ver precios','📞 Llamar a un experto']);
    hideSubtitle();
  }},

  // 5 - Click to Call (IN CHAT - CTA button)
  { label: '6/16 · Click-to-Call: boton en chat', run: async () => {
    showSubtitle('CLICK TO CALL - Boton de llamada en el chat');
    await speak('Ahora veamos la funcionalidad de click to call. El bot ofrece un boton de llamada directa dentro del chat. Es un boton verde prominente con animacion de telefono que invita al visitante a llamar gratuitamente via WebRTC.');
    await wait(300);
    addBotMsg('Si prefieres, puedes llamarnos directamente. La llamada es gratuita desde tu navegador:');
    await wait(400);
    addCallCTA('Habla con un experto SEO de Boostic', 'Llamada gratuita via WebRTC · Sin coste');
    await wait(800);
    // Highlight the call button
    const btn = document.getElementById('call-cta-btn');
    if (btn) { const r = btn.getBoundingClientRect(); moveCursor(r.left+30, r.top+20); await wait(600); clickCursor(); }
    hideSubtitle();
    hideCursor();
  }},

  // 6 - Click to Call (HEADER button)
  { label: '7/16 · Click-to-Call: boton del header', run: async () => {
    showSubtitle('Boton de llamada en la cabecera del widget');
    await speak('Ademas del boton en el chat, el widget tiene un icono de telefono permanente en la cabecera. El visitante puede pulsar el telefono en cualquier momento para iniciar una llamada VoIP sin salir del chat.');
    const r = wCallBtn.getBoundingClientRect(); moveCursor(r.left+10, r.top+10); await wait(600);
    clickCursor(); wCallBtn.classList.add('call-active');
    await wait(500);
    hideCursor(); hideSubtitle();
  }},

  // 7 - Call panel (connecting)
  { label: '8/16 · Llamada VoIP: conectando', run: async () => {
    showSubtitle('Conectando llamada VoIP via SIP.js + WebRTC');
    showCallView();
    $('cp-status-text').textContent = 'Registrando SIP...';
    $('cp-status-text').style.color = 'rgba(255,255,255,0.7)';
    $('cp-dot').style.background = 'var(--orange)';
    $('cp-timer').textContent = '00:00';
    $('cp-quality').style.display = 'none';
    $('cp-encrypted').style.display = 'none';
    await speak('Se inicia la llamada VoIP. El sistema registra al visitante como usuario SIP temporal via SIP punto JS. La conexion se establece con WebRTC encriptado usando SRTP y DTLS.');
    await wait(800);
    $('cp-status-text').textContent = 'Conectando con Boostic...';
    await wait(1500);
    $('cp-status-text').textContent = 'Sonando...';
    $('cp-dot').style.background = 'var(--blue)';
    await wait(2000);
    hideSubtitle();
  }},

  // 8 - Call active
  { label: '9/16 · Llamada VoIP: en curso', run: async () => {
    showSubtitle('Llamada activa con encriptacion SRTP');
    $('cp-status-text').textContent = 'En llamada';
    $('cp-status-text').style.color = '#34D399';
    $('cp-dot').style.background = 'var(--green)';
    $('cp-quality').style.display = 'flex';
    $('cp-encrypted').style.display = 'flex';
    let sec = 0;
    const iv = setInterval(() => { sec++; $('cp-timer').textContent = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; if(sec>=12)clearInterval(iv); }, 1000);
    await speak('La llamada esta activa. El visitante habla directamente con un experto de Boostic. Se muestra el temporizador, la calidad de conexion y el indicador de cifrado SRTP. Los controles permiten silenciar el microfono, colgar o activar el altavoz. La llamada se enruta por la centralita Asterisk a la cola del departamento correcto.');
    await wait(3000);
    // Show mute toggle
    $('cp-mute').classList.add('active');
    await wait(1000);
    $('cp-mute').classList.remove('active');
    hideSubtitle();
  }},

  // 9 - Call ends
  { label: '10/16 · Llamada finalizada', run: async () => {
    showSubtitle('Llamada finalizada - volvemos al chat');
    $('cp-status-text').textContent = 'Llamada finalizada';
    $('cp-status-text').style.color = 'rgba(255,255,255,0.5)';
    $('cp-dot').style.background = 'var(--gray)';
    await speak('La llamada ha finalizado. El sistema registra la duracion, la grabacion y el resultado. El visitante vuelve automaticamente al chat donde puede seguir la conversacion o dejar sus datos.');
    await wait(1500);
    wCallBtn.classList.remove('call-active');
    showChat();
    addSystemMsg('Llamada finalizada (0:12) - Agente: Ana Garcia');
    await wait(500);
    addBotMsg('Gracias por la llamada! Si necesitas algo mas, aqui estoy. Tambien puedes dejarnos tus datos para que te enviemos la propuesta por email.');
    hideSubtitle();
  }},

  // 10 - Lead capture
  { label: '11/16 · Captacion de leads', run: async () => {
    showSubtitle('Formulario de captacion de leads');
    await speak('Despues de la llamada, el bot ofrece un formulario de captacion de leads. El visitante deja su nombre, email y empresa. El sistema calcula automaticamente un lead score basado en toda la interaccion: el chat, la llamada y el interes mostrado.');
    await wait(300); addLeadForm(); await wait(600);
    await typeText($('lf-name'), 'Maria Lopez');
    await wait(200); await typeText($('lf-email'), 'maria@mitienda.com');
    await wait(200); await typeText($('lf-company'), 'MiTienda Online SL');
    await wait(400);
    const btn = document.querySelector('.lf-btn'); btn.style.background = 'var(--green)'; btn.textContent = 'Enviado \u2713';
    await wait(300); addSystemMsg('Lead capturado - Score: 85/100 (incluye llamada)');
    hideSubtitle();
  }},

  // 11 - File upload
  { label: '12/16 · Subida de archivos', run: async () => {
    showSubtitle('Adjuntar archivos en el chat');
    await speak('El visitante puede adjuntar archivos directamente en el chat. El sistema valida el tipo MIME, sanitiza el nombre y almacena el archivo de forma segura. Las imagenes se muestran en miniatura y los documentos como adjuntos descargables.');
    await wait(300); addFile('especificaciones-proyecto.pdf', '2.4 MB', 'PDF');
    addUserMsg('📎 Te adjunto las especificaciones'); await wait(300);
    addTyping(); await wait(1000); removeTyping();
    addBotMsg('Perfecto, he recibido <strong>especificaciones-proyecto.pdf</strong>. Lo adjunto a tu expediente para que el equipo lo revise.');
    hideSubtitle();
  }},

  // 12 - Escalation
  { label: '13/16 · Escalacion a agente', run: async () => {
    showSubtitle('Escalacion a un agente humano');
    await typeText(chatInput, 'Quiero hablar con una persona'); await wait(200);
    addUserMsg('Quiero hablar con una persona'); chatInput.value = '';
    await speak('El visitante solicita hablar con un humano. El sistema busca un agente disponible con las habilidades adecuadas: idioma espanol y experiencia en la linea Boostic. Ana Garcia acepta la conversacion.');
    await wait(300); addSystemMsg('Buscando agente especializado...');
    await wait(1200); addSystemMsg('Ana Garcia (Boostic) se ha unido');
    await wait(300);
    addBotMsg('Hola Maria! Soy Ana del equipo Boostic. He visto tu consulta sobre SEO, tu llamada y el PDF que adjuntaste. Vamos a prepararte una propuesta personalizada.');
    hideSubtitle();
  }},

  // 13 - Dashboard
  { label: '14/16 · Dashboard de agentes', run: async () => {
    closeWidget(); await wait(300); showDashboard();
    showSubtitle('Vista del dashboard de agentes');
    addDashConv(1,'Maria Lopez','Auditoria SEO + llamada realizada','#3B82F6','Boostic','#3B82F6','2:15');
    addDashConv(2,'Pedro Ruiz','Dashboard de KPIs de ventas','#8B5CF6','Binnacle','#8B5CF6','0:45');
    addDashConv(3,'Sarah Miller','Google Ads campaign help','#10B981','Marketing','#10B981','5:30');
    $('do-conv-1').classList.add('active');
    await wait(400);
    showAISummary('&#x2022; Interesada en <strong>auditoria SEO</strong> para e-commerce<br>&#x2022; <strong>Llamada VoIP realizada</strong> (0:12, resultado positivo)<br>&#x2022; Lead Score: <strong>85/100</strong><br>&#x2022; Adjunto: especificaciones-proyecto.pdf<br>&#x2022; Contacto: maria@mitienda.com');
    await speak('Cambiamos a la vista del dashboard. Ana ve la cola con tres conversaciones. El resumen generado por inteligencia artificial muestra que Maria hizo una llamada VoIP, tiene un lead score alto y adjunto un PDF.');
    await wait(400);
    addDashMsg('visitor','Tengo una tienda online y quiero mejorar mi SEO');
    await wait(200); addDashMsg('visitor','Cuanto cuesta una auditoria SEO?');
    await wait(200); addDashMsg('note','Sistema: Llamada VoIP realizada (0:12)');
    await wait(200); addDashMsg('agent','Hola Maria! He revisado tu proyecto y la llamada. Preparo la propuesta.');
    await wait(300);
    const input = $('do-input-field');
    await typeText(input, 'Te envio la propuesta por email en 24h con el Plan Growth.');
    await wait(200); addDashMsg('agent','Te envio la propuesta por email en 24h con el Plan Growth. Incluye auditoria completa + 6 meses de acompanamiento por 3.200 euros.');
    input.value = '';
    await wait(300); addDashMsg('note','Ana: Lead caliente. Programar seguimiento manana.');
    hideSubtitle();
  }},

  // 14 - CSAT
  { label: '15/16 · Encuesta CSAT', run: async () => {
    hideDashboard(); await wait(300); openWidget(); showChat();
    showSubtitle('Encuesta de satisfaccion');
    await wait(300); addSystemMsg('Conversacion finalizada');
    await speak('Al cerrar la conversacion, el visitante recibe una encuesta de satisfaccion con cinco estrellas. Maria puntua con cinco estrellas, excelente. Todos los datos quedan registrados: chat, llamada VoIP, lead, archivos y valoracion.');
    await wait(300); addCSAT(); await wait(1000); fillCSAT(5);
    await wait(400);
    addBotMsg('Gracias por tu valoracion! Ha sido un placer atenderte. Si necesitas algo mas, no dudes en escribirnos o llamarnos.');
    await wait(300); addQR(['Nueva conversacion','📞 Llamar de nuevo','Cerrar']);
    hideSubtitle();
  }},

  // 15 - Closing
  { label: '16/16 · Resumen', run: async () => {
    closeWidget();
    showSubtitle('Resumen de la plataforma');
    await speak('En resumen, el chatbot de Redegal es una plataforma completa. Chat con inteligencia artificial, click to call con VoIP integrado en el widget, captacion de leads con scoring automatico, dashboard profesional para agentes, trece idiomas, cuatro integraciones CRM, webhooks, plugins para WordPress, Shopify y Magento, y ciento dieciocho tests automatizados. Todo desplegable con Docker Compose en un solo comando. Gracias por ver esta demo.');
    hideSubtitle(); await wait(2000);
  }}
];

// ════════════════════════════════════════════
// PLAYBACK
// ════════════════════════════════════════════

async function runDemo() {
  demoRunning = true;
  startOverlay.classList.add('hidden');
  for (let i = 0; i < scenes.length; i++) {
    if (!demoRunning) break;
    showSceneLabel(scenes[i].label);
    await scenes[i].run();
    await wait(1200);
  }
  hideSceneLabel();
  demoRunning = false;
}

$('start-btn').addEventListener('click', runDemo);
startOverlay.addEventListener('click', (e) => { if (e.target === startOverlay) runDemo(); });
