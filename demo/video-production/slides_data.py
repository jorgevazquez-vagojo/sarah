"""
Sarah — Definiciones de Slides y Narración
Total: ~50 slides → ~40 minutos de video
"""

V_MAIN = "es-ES-AlvaroNeural"
V_FEMALE = "es-ES-ElviraNeural"

# Colors
C_TEAL = (0, 212, 170)
C_PURPLE = (108, 92, 231)
C_BLUE = (59, 130, 246)
C_GREEN = (16, 185, 129)
C_ORANGE = (245, 158, 11)
C_RED = (227, 6, 19)

SLIDES = [

# ═══════════════════════════════════════════
# CAPÍTULO 0: APERTURA
# ═══════════════════════════════════════════
{
    "type": "title",
    "chapter_num": 0, "chapter_title": "",
    "content": {
        "tag": "REDEGAL PRESENTA",
        "title": "Sarah",
        "subtitle": "Asistente Inteligente para tu Web"
    },
    "duration": 4.0,  # silent title card
},
{
    "type": "title",
    "chapter_num": 0, "chapter_title": "",
    "content": {
        "tag": "CHATBOT IA  ·  VOIP  ·  DASHBOARD  ·  CRM",
        "title": "Demo Completa",
        "subtitle": "Instalación, configuración y uso — Guía profesional"
    },
    "narration": "Bienvenidos. En este vídeo vamos a descubrir Sarah, el asistente inteligente de nueva generación desarrollado por Redegal. Veremos todas sus capacidades: chat con inteligencia artificial, telefonía VoIP integrada, dashboard para agentes, integración con CRMs, y mucho más. También veremos paso a paso cómo instalarlo en una web real.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 1: VISIÓN GENERAL
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 1, "chapter_title": "Visión General",
    "content": {"num": 1, "title": "Visión General", "subtitle": "Qué es Sarah y por qué la necesitas"},
    "duration": 3.0,
},
{
    "type": "bullets",
    "chapter_num": 1, "chapter_title": "Visión General",
    "content": {
        "title": "El Problema",
        "items": [
            "Un visitante llega a tu web con una pregunta. No encuentra respuesta inmediata. Se va.",
            "Los formularios de contacto tardan horas o días en responderse. Oportunidad perdida.",
            "Los chatbots genéricos frustran más de lo que ayudan. Respuestas irrelevantes.",
            "Sin atención fuera de horario laboral. El 40% de las visitas ocurren fuera de horario.",
            "Los leads se pierden entre departamentos. Sin trazabilidad ni seguimiento.",
        ]
    },
    "narration": "Las empresas pierden oportunidades cada día. Un visitante llega a tu web, tiene una pregunta, pero no encuentra respuesta inmediata. Se va. Oportunidad perdida. Los formularios de contacto tardan horas o días en responderse. Los chatbots genéricos frustran más de lo que ayudan, con respuestas irrelevantes que no resuelven nada. Además, sin atención fuera de horario laboral, pierdes el cuarenta por ciento de visitas que ocurren por la noche o en fin de semana. Y los leads se pierden entre departamentos, sin trazabilidad ni seguimiento.",
    "voice": V_MAIN,
},
{
    "type": "bullets",
    "chapter_num": 1, "chapter_title": "Visión General",
    "content": {
        "title": "La Solución: Sarah",
        "items": [
            "Inteligencia artificial entrenada con el conocimiento real de tu empresa.",
            "Responde al instante en 4 idiomas: español, inglés, portugués y gallego.",
            "Cualifica leads automáticamente con puntuación inteligente.",
            "Conecta con agentes humanos por chat o por teléfono cuando es necesario.",
            "Se integra con tu CRM, tu sistema de webhooks y tu web en minutos.",
            "Funciona 24 horas, 7 días a la semana, sin interrupciones.",
        ]
    },
    "narration": "Sarah cambia las reglas del juego. Es un asistente inteligente que responde al instante con inteligencia artificial entrenada con el conocimiento real de tu empresa. Detecta automáticamente el idioma del visitante y responde en español, inglés, portugués o gallego. Cualifica leads en tiempo real con puntuación inteligente. Y cuando el visitante necesita hablar con una persona, conecta directamente con el agente adecuado por chat o por teléfono. Se integra con tu CRM y tu web en minutos. Y funciona las veinticuatro horas, los siete días de la semana.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 2: CARACTERÍSTICAS PRINCIPALES
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 2, "chapter_title": "Características",
    "content": {"num": 2, "title": "Características Principales", "subtitle": "Todo lo que Sarah puede hacer por ti"},
    "duration": 3.0,
},
{
    "type": "grid",
    "chapter_num": 2, "chapter_title": "Características",
    "content": {
        "title": "Funcionalidades Clave",
        "cols": 4,
        "items": [
            {"icon": "🤖", "label": "IA Multi-Proveedor", "desc": "Claude + Gemini + OpenAI con fallback automático", "color": C_TEAL},
            {"icon": "🌍", "label": "4 Idiomas", "desc": "ES, EN, PT, GL con detección automática", "color": C_BLUE},
            {"icon": "📞", "label": "SarahPhone VoIP", "desc": "Llamadas desde el navegador vía WebRTC", "color": C_GREEN},
            {"icon": "👥", "label": "Dashboard Agentes", "desc": "Cola, chat, analytics y configuración", "color": C_PURPLE},
            {"icon": "📊", "label": "Lead Scoring", "desc": "Puntuación automática hasta 100 pts", "color": C_ORANGE},
            {"icon": "🔗", "label": "CRM Integration", "desc": "Salesforce, HubSpot, Zoho, Pipedrive", "color": C_BLUE},
            {"icon": "🔔", "label": "Webhooks HMAC", "desc": "10+ eventos firmados criptográficamente", "color": C_RED},
            {"icon": "🔌", "label": "Plugins", "desc": "WordPress, Shopify, Magento listos", "color": C_GREEN},
        ]
    },
    "narration": "Veamos las capacidades principales de Sarah. Inteligencia artificial multi-proveedor con Claude de Anthropic como motor principal, y Gemini de Google y OpenAI como respaldo automático. Soporte para cuatro idiomas con detección automática. Telefonía VoIP integrada con SarahPhone, que permite llamar directamente desde el navegador usando WebRTC. Dashboard profesional para agentes humanos. Captura de leads con puntuación automática. Integración con los principales CRMs del mercado. Webhooks firmados criptográficamente para integración con cualquier sistema. Y plugins listos para WordPress, Shopify y Magento.",
    "voice": V_MAIN,
},
{
    "type": "grid",
    "chapter_num": 2, "chapter_title": "Características",
    "content": {
        "title": "Más Capacidades",
        "cols": 4,
        "items": [
            {"icon": "💬", "label": "Rich Messages", "desc": "Carruseles, botones, tarjetas interactivas", "color": C_TEAL},
            {"icon": "📎", "label": "File Upload", "desc": "Adjuntar archivos hasta 10MB", "color": C_BLUE},
            {"icon": "⭐", "label": "Encuestas CSAT", "desc": "Satisfacción al cerrar conversación", "color": C_ORANGE},
            {"icon": "📧", "label": "Email Alerts", "desc": "Notificaciones HTML profesionales", "color": C_GREEN},
            {"icon": "🛡️", "label": "Seguridad", "desc": "CSRF, CORS, JWT, rate limit, Shadow DOM", "color": C_RED},
            {"icon": "⚡", "label": "Tiempo Real", "desc": "WebSocket bidireccional instantáneo", "color": C_PURPLE},
            {"icon": "🎨", "label": "Tema Custom", "desc": "Colores, fonts, layout, sonidos, logo", "color": C_TEAL},
            {"icon": "📈", "label": "Analytics", "desc": "Métricas de conversación, leads, CSAT", "color": C_BLUE},
        ]
    },
    "narration": "Además, Sarah ofrece mensajes enriquecidos como carruseles y botones interactivos. Subida de archivos adjuntos. Encuestas de satisfacción al cerrar cada conversación. Notificaciones por email con plantillas HTML profesionales. Seguridad de nivel empresarial con protección CSRF, CORS, autenticación JWT y aislamiento Shadow DOM. Comunicación en tiempo real por WebSocket. Personalización total del tema visual. Y analytics completos para medir el rendimiento.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 3: ARQUITECTURA TÉCNICA
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 3, "chapter_title": "Arquitectura",
    "content": {"num": 3, "title": "Arquitectura Técnica", "subtitle": "Cómo funciona Sarah por dentro"},
    "duration": 3.0,
},
{
    "type": "grid",
    "chapter_num": 3, "chapter_title": "Arquitectura",
    "content": {
        "title": "Stack Tecnológico",
        "cols": 3,
        "items": [
            {"icon": "⬢", "label": "Node.js 20", "desc": "Servidor Express con 3 WebSocket paths", "color": C_GREEN},
            {"icon": "⚛", "label": "React 19", "desc": "Widget IIFE + Dashboard SPA con TypeScript", "color": C_BLUE},
            {"icon": "🐘", "label": "PostgreSQL 16", "desc": "pgvector para búsqueda semántica en KB", "color": C_BLUE},
            {"icon": "🔴", "label": "Redis 7", "desc": "Caché, sesiones, pub/sub en tiempo real", "color": C_RED},
            {"icon": "🌐", "label": "Janus Gateway", "desc": "Relay WebRTC para telefonía VoIP", "color": C_ORANGE},
            {"icon": "🤖", "label": "Multi-IA", "desc": "Claude primary + Gemini free + OpenAI fallback", "color": C_PURPLE},
        ]
    },
    "narration": "La arquitectura de Sarah está construida sobre un stack moderno y robusto. El servidor usa Node.js 20 con Express y tres conexiones WebSocket independientes: una para el chat del visitante, otra para el dashboard de agentes, y otra para la señalización VoIP. El frontend está construido con React 19 y TypeScript. La base de datos es PostgreSQL 16 con la extensión pgvector para búsqueda semántica en la base de conocimiento. Redis 7 para caché y comunicación en tiempo real. Janus Gateway como relay WebRTC para las llamadas. Y la inteligencia artificial es multi-proveedor: Claude de Anthropic como motor principal, con Gemini de Google como opción gratuita y OpenAI como respaldo.",
    "voice": V_MAIN,
},
{
    "type": "bullets",
    "chapter_num": 3, "chapter_title": "Arquitectura",
    "content": {
        "title": "Flujo de Datos",
        "items": [
            "1. El visitante abre tu web → el widget Sarah se carga en un Shadow DOM aislado.",
            "2. Escribe un mensaje → se envía por WebSocket al servidor en tiempo real.",
            "3. El servidor consulta la base de conocimiento (pgvector) → genera respuesta con IA.",
            "4. Si necesita un humano → la conversación se escala al dashboard de agentes.",
            "5. El agente responde por chat o inicia una llamada VoIP vía SarahPhone.",
            "6. Al cerrar → encuesta CSAT, lead scoring, CRM dispatch, webhook events.",
        ]
    },
    "narration": "El flujo de datos funciona así. Primero, el visitante abre tu web y el widget de Sarah se carga automáticamente dentro de un Shadow DOM aislado, sin afectar al CSS ni al JavaScript de tu página. Cuando el visitante escribe un mensaje, se envía por WebSocket al servidor en tiempo real. El servidor consulta la base de conocimiento usando búsqueda semántica con pgvector, y genera una respuesta con inteligencia artificial. Si el visitante necesita hablar con una persona, la conversación se escala al dashboard de agentes. El agente puede responder por chat o iniciar una llamada VoIP con SarahPhone. Al cerrar la conversación, se lanza automáticamente una encuesta de satisfacción, se calcula la puntuación del lead, se envían datos al CRM, y se disparan los webhooks configurados.",
    "voice": V_MAIN,
},
{
    "type": "code",
    "chapter_num": 3, "chapter_title": "Arquitectura",
    "content": {
        "title": "Tres WebSocket Paths",
        "desc": "Cada tipo de conexión tiene su propio canal WebSocket independiente",
        "code": [
            ("// server/index.js — WebSocket Routing", (139, 148, 158)),
            ("", (0,0,0)),
            ("const wssChat  = new WebSocketServer({ noServer: true });   // /ws/chat", (201, 209, 217)),
            ("const wssAgent = new WebSocketServer({ noServer: true });   // /ws/agent", (201, 209, 217)),
            ("const wssSip   = new WebSocketServer({ noServer: true });   // /ws/sip", (201, 209, 217)),
            ("", (0,0,0)),
            ("server.on('upgrade', (req, socket, head) => {", (255, 123, 114)),
            ("  const pathname = new URL(req.url, 'http://x').pathname;", (201, 209, 217)),
            ("", (0,0,0)),
            ("  if (pathname === '/ws/chat')  wssChat.handleUpgrade(...);", (165, 214, 255)),
            ("  if (pathname === '/ws/agent') wssAgent.handleUpgrade(...);", (165, 214, 255)),
            ("  if (pathname === '/ws/sip')   wssSip.handleUpgrade(...);", (165, 214, 255)),
            ("});", (255, 123, 114)),
            ("", (0,0,0)),
            ("// Chat: visitantes ↔ bot/agente", (139, 148, 158)),
            ("// Agent: dashboard agentes ↔ cola", (139, 148, 158)),
            ("// SIP: señalización WebRTC ↔ Janus ↔ PBX", (139, 148, 158)),
        ]
    },
    "narration": "A nivel técnico, el servidor de Sarah define tres canales WebSocket independientes. El primero, ws chat, gestiona la comunicación entre visitantes y el bot o los agentes. El segundo, ws agent, conecta el dashboard de agentes con la cola de espera en tiempo real. Y el tercero, ws sip, maneja la señalización WebRTC para las llamadas VoIP a través de Janus Gateway y la centralita telefónica. Esta separación garantiza que cada tipo de comunicación es independiente y escalable.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 4: INSTALACIÓN EN LA WEB DE REDEGAL
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 4, "chapter_title": "Instalación",
    "content": {"num": 4, "title": "Instalación", "subtitle": "Cómo integrar Sarah en la web de Redegal"},
    "duration": 3.0,
},
{
    "type": "bullets",
    "chapter_num": 4, "chapter_title": "Instalación",
    "content": {
        "title": "Requisitos Previos",
        "items": [
            "Docker y Docker Compose instalados en tu servidor.",
            "Acceso SSH al servidor de destino.",
            "Un dominio o subdominio para Sarah (ej: chatbot.redegal.com).",
            "Claves API de al menos un proveedor de IA (Gemini es gratuito).",
            "Acceso para añadir un script a tu web (footer del tema).",
        ]
    },
    "narration": "Ahora vamos a ver paso a paso cómo instalar Sarah en una web real. Usaremos como ejemplo la web corporativa de Redegal, que podemos ver funcionando en nuestro entorno local. Los requisitos son mínimos: Docker y Docker Compose instalados en tu servidor, acceso SSH, un dominio o subdominio para Sarah como chatbot punto redegal punto com, las claves API de al menos un proveedor de inteligencia artificial, y acceso para añadir un pequeño script al footer de tu web.",
    "voice": V_MAIN,
},
{
    "type": "code",
    "chapter_num": 4, "chapter_title": "Instalación",
    "content": {
        "title": "Paso 1: Docker Compose",
        "desc": "Un solo comando levanta toda la infraestructura",
        "code": [
            ("$ git clone https://github.com/jorgevazquez-vagojo/sarah.git", C_GREEN),
            ("$ cd sarah", C_GREEN),
            ("", (0,0,0)),
            ("$ docker compose up -d", (165, 214, 255)),
            ("", (0,0,0)),
            ("[+] Running 5/5", (139, 148, 158)),
            (" ✓ postgres    Started    (pgvector/pg16)", C_GREEN),
            (" ✓ redis       Started    (redis:7-alpine)", C_GREEN),
            (" ✓ server      Started    (node:20 + express)", C_GREEN),
            (" ✓ janus       Started    (janus-gateway WebRTC)", C_GREEN),
            ("", (0,0,0)),
            ("# 4 servicios levantados:", (139, 148, 158)),
            ("# PostgreSQL 16 → Base de datos + pgvector", (139, 148, 158)),
            ("# Redis 7      → Caché + sesiones + pub/sub", (139, 148, 158)),
            ("# Server       → Node.js 20 + Express + WebSocket", (139, 148, 158)),
            ("# Janus        → WebRTC Gateway para VoIP", (139, 148, 158)),
        ]
    },
    "narration": "El primer paso es clonar el repositorio y levantar la infraestructura con Docker Compose. Con un solo comando, docker compose up, se despliegan cuatro servicios automáticamente: PostgreSQL 16 con la extensión pgvector para la base de datos y búsqueda semántica, Redis 7 para caché, sesiones y comunicación en tiempo real, el servidor de Sarah con Node.js 20 y Express, y Janus Gateway para la telefonía WebRTC. Todo queda configurado y conectado en segundos.",
    "voice": V_MAIN,
},
{
    "type": "code",
    "chapter_num": 4, "chapter_title": "Instalación",
    "content": {
        "title": "Paso 2: Configuración (.env)",
        "desc": "Variables de entorno para personalizar Sarah",
        "code": [
            ("# Inteligencia Artificial", (139, 148, 158)),
            ("AI_PROVIDER=gemini                    # claude | gemini | openai", (201, 209, 217)),
            ("GEMINI_API_KEY=AIzaSy...              # Gratuito, 20 req/día", (165, 214, 255)),
            ("ANTHROPIC_API_KEY=sk-ant-...          # Claude (premium)", (165, 214, 255)),
            ("", (0,0,0)),
            ("# Telefonía VoIP (Vozelia Cloud PBX)", (139, 148, 158)),
            ("SIP_DOMAIN=cloudpbx1584.vozelia.com", (201, 209, 217)),
            ("SIP_EXTENSION=108                     # Extension Click2Call", (201, 209, 217)),
            ("SIP_PASSWORD=0H1Y...                  # Credencial SIP", (201, 209, 217)),
            ("CLICK2CALL_EXTENSIONS=107,158,105     # Agentes por extensión", (201, 209, 217)),
            ("", (0,0,0)),
            ("# Horario y Branding", (139, 148, 158)),
            ("TIMEZONE=Europe/Madrid", (201, 209, 217)),
            ("BUSINESS_HOURS_START=9", (201, 209, 217)),
            ("BUSINESS_HOURS_END=19", (201, 209, 217)),
            ("PRIMARY_COLOR=#007fff", (201, 209, 217)),
        ]
    },
    "narration": "La configuración se hace a través de un archivo punto env. Aquí defines el proveedor de inteligencia artificial y sus claves API. Gemini de Google es gratuito con veinte peticiones al día, perfecto para empezar. Claude de Anthropic ofrece mayor calidad. También configuras la telefonía VoIP con el dominio SIP, la extensión de Click to Call, y las extensiones de los agentes que recibirán las llamadas. Finalmente, el horario de atención y los colores de tu marca.",
    "voice": V_MAIN,
},
{
    "type": "code",
    "chapter_num": 4, "chapter_title": "Instalación",
    "content": {
        "title": "Paso 3: Integrar en la Web de Redegal",
        "desc": "Añadir este fragmento antes del cierre de </body>",
        "code": [
            ("<!-- footer.php del tema WordPress de Redegal -->", (139, 148, 158)),
            ("", (0,0,0)),
            ("<script>", (255, 123, 114)),
            ("  window.Sarah = {", (201, 209, 217)),
            ("    baseUrl: 'https://chatbot.redegal.com/widget',", (165, 214, 255)),
            ("    configUrl: 'https://chatbot.redegal.com/api/config/widget',", (165, 214, 255)),
            ("    language: 'auto',", (165, 214, 255)),
            ("    primaryColor: '#00d4aa',", (165, 214, 255)),
            ("    theme: {", (201, 209, 217)),
            ("      branding: {", (201, 209, 217)),
            ("        companyName: 'Redegal',", (165, 214, 255)),
            ("        botName: 'Sarah',", (165, 214, 255)),
            ("      },", (201, 209, 217)),
            ("      features: {", (201, 209, 217)),
            ("        enableVoip: true,", C_GREEN),
            ("        enableLeadForm: true,", C_GREEN),
            ("        enableLanguageSelector: true,", C_GREEN),
            ("      }", (201, 209, 217)),
            ("    }", (201, 209, 217)),
            ("  };", (201, 209, 217)),
            ("</script>", (255, 123, 114)),
            ('<script async src="https://chatbot.redegal.com/widget/loader.js"></script>', (255, 123, 114)),
        ]
    },
    "narration": "Para integrar Sarah en la web de Redegal, añadimos un fragmento de código en el footer del tema WordPress. Primero definimos el objeto window punto Sarah con la configuración. La URL del servidor, el idioma en modo automático para que detecte el idioma del visitante, el color primario de Redegal, y las opciones del tema: nombre de empresa, nombre del bot, y las funcionalidades habilitadas como VoIP, formulario de leads, y selector de idioma. Después cargamos el script loader punto JS de forma asíncrona. Este loader crea automáticamente un Shadow DOM aislado y monta el widget sin interferir con el CSS de la página.",
    "voice": V_MAIN,
},
{
    "type": "split",
    "chapter_num": 4, "chapter_title": "Instalación",
    "content": {
        "title": "Resultado: Sarah en Redegal.com",
        "text": "El widget aparece automáticamente en la esquina inferior derecha de la web. Se carga de forma asíncrona sin afectar al rendimiento de la página.",
        "items": [
            "Shadow DOM aislado: CSS de Sarah no afecta a la web.",
            "Carga asíncrona: no bloquea el renderizado.",
            "Widget responsivo: se adapta a móvil y escritorio.",
            "Solo 227KB JS + 13KB CSS (71KB gzip).",
            "Z-index máximo: siempre visible sobre el contenido.",
        ],
        "visual": "widget",
        "messages": [
            {"bot": True, "text": "¡Hola! Soy Sarah, tu asistente de Redegal."},
            {"bot": True, "text": "¿En qué puedo ayudarte hoy?"},
            {"bot": False, "text": "Necesito info sobre SEO"},
            {"bot": True, "text": "Nuestro servicio Boostic es líder en SEO."},
        ]
    },
    "narration": "Y este es el resultado. Sarah aparece automáticamente en la esquina inferior derecha de la web de Redegal. Se carga dentro de un Shadow DOM completamente aislado, lo que significa que el CSS de Sarah nunca interfiere con el diseño de tu página, y viceversa. La carga es asíncrona para no bloquear el renderizado. El widget es responsivo y se adapta a móvil y escritorio. Pesa solo 227 kilobytes de JavaScript y 13 de CSS, que con compresión gzip se reducen a solo 71 kilobytes. Y se posiciona con el z-index máximo para estar siempre visible sobre el contenido.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 5: SETUP WIZARD
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 5, "chapter_title": "Setup Wizard",
    "content": {"num": 5, "title": "Setup Wizard", "subtitle": "Configuración guiada en 5 pasos"},
    "duration": 3.0,
},
{
    "type": "bullets",
    "chapter_num": 5, "chapter_title": "Setup Wizard",
    "content": {
        "title": "Asistente de Configuración Inicial",
        "items": [
            "Paso 1 — Datos de Empresa: nombre, logo, colores corporativos y dirección.",
            "Paso 2 — Inteligencia Artificial: proveedor, claves API, prompt del sistema.",
            "Paso 3 — Email y Notificaciones: servidor SMTP, destinatarios de alertas.",
            "Paso 4 — Líneas de Negocio: Boostic, Binnacle, Marketing, Tech con extensiones.",
            "Paso 5 — Revisión y Activación: resumen completo y botón de activar.",
        ]
    },
    "narration": "La primera vez que accedes a Sarah, te recibe un asistente de configuración guiado. Son cinco pasos sencillos. En el paso uno, introduces los datos de tu empresa: nombre, logo y colores corporativos. En el paso dos, configuras el proveedor de inteligencia artificial y sus claves API. En el paso tres, configuras el servidor de email para las notificaciones. En el paso cuatro, defines tus líneas de negocio: Boostic para SEO, Binnacle para analítica, Marketing digital y Tech para desarrollo. Cada línea tiene su propia extensión telefónica. Y en el paso cinco, revisas todo y activas el sistema con un solo clic.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 6: DEMO — CHAT IA EN ACCIÓN
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 6, "chapter_title": "Chat IA",
    "content": {"num": 6, "title": "Chat con IA en Acción", "subtitle": "Experiencia del visitante paso a paso"},
    "duration": 3.0,
},
{
    "type": "split",
    "chapter_num": 6, "chapter_title": "Chat IA",
    "content": {
        "title": "El Visitante Llega a la Web",
        "text": "Imaginemos que una visitante llega a la web corporativa de Redegal buscando una solución de posicionamiento SEO para su empresa.",
        "items": [
            "Navegando por redegal.com ve el icono de chat en la esquina inferior derecha.",
            "Hace clic y se abre el widget de Sarah con un mensaje de bienvenida.",
            "Sarah detecta automáticamente su idioma por el navegador.",
        ],
        "visual": "widget",
        "messages": [
            {"bot": True, "text": "¡Hola! Soy Sarah, asistente de Redegal."},
            {"bot": True, "text": "¿En qué puedo ayudarte hoy?"},
        ]
    },
    "narration": "Imaginemos que soy una visitante que llega a la web corporativa de Redegal. Estoy buscando una solución de posicionamiento SEO para mi empresa. Navego por la página y en la esquina inferior derecha veo un pequeño icono de chat. Al hacer clic, se abre un widget elegante con un mensaje de bienvenida personalizado: Hola, soy Sarah, tu asistente virtual de Redegal. En qué puedo ayudarte hoy. Sarah ha detectado automáticamente que mi navegador está en español.",
    "voice": V_FEMALE,
},
{
    "type": "split",
    "chapter_num": 6, "chapter_title": "Chat IA",
    "content": {
        "title": "Conversación Inteligente",
        "text": "Sarah responde con información precisa extraída de la base de conocimiento de Redegal. No inventa respuestas: busca en documentos reales de la empresa.",
        "items": [
            "Búsqueda semántica en la base de conocimiento con pgvector.",
            "Contexto inyectado al prompt de IA para respuestas precisas.",
            "Rich messages: botones, carruseles, tarjetas de servicio.",
            "Detección de intención: consulta, queja, compra, soporte.",
        ],
        "visual": "widget",
        "messages": [
            {"bot": False, "text": "Necesito mejorar el SEO de mi tienda online"},
            {"bot": True, "text": "Boostic es nuestra línea especializada en SEO"},
            {"bot": True, "text": "Trabajamos con +200 clientes como Lacoste"},
            {"bot": False, "text": "¿Qué resultados puedo esperar?"},
            {"bot": True, "text": "Incrementos del 40-200% en tráfico orgánico"},
        ]
    },
    "narration": "Escribo mi consulta: Necesito mejorar el posicionamiento de mi tienda online. Sarah responde de inmediato con información precisa sobre Boostic, la línea de negocio de Redegal especializada en SEO y growth. No inventa respuestas: busca en los documentos reales de la empresa usando búsqueda semántica con pgvector. Menciona casos de éxito reales, como Lacoste y Adolfo Domínguez. Cuando pregunto qué resultados puedo esperar, me da datos concretos. La conversación se siente natural e informativa, no como un bot genérico.",
    "voice": V_FEMALE,
},
{
    "type": "split",
    "chapter_num": 6, "chapter_title": "Chat IA",
    "content": {
        "title": "Captura de Lead Inteligente",
        "text": "Cuando detecta interés real, Sarah solicita datos de contacto de forma natural y no intrusiva.",
        "items": [
            "Lead scoring automático: nombre (10 pts), email (20 pts), empresa (15 pts), teléfono (15 pts).",
            "Detección de intención de compra: +20 puntos extra.",
            "Línea de negocio detectada automáticamente por contexto.",
            "Datos enviados al CRM configurado en tiempo real.",
            "Webhook disparado: evento lead_created con toda la información.",
        ],
        "visual": "widget",
        "messages": [
            {"bot": True, "text": "¿Te gustaría que un especialista te contacte?"},
            {"bot": False, "text": "Sí, por favor"},
            {"bot": True, "text": "Perfecto. ¿Cuál es tu nombre?"},
            {"bot": False, "text": "Isabel García, de TechStore"},
            {"bot": True, "text": "Gracias Isabel. ¿Tu email de contacto?"},
            {"bot": False, "text": "isabel@techstore.es"},
        ]
    },
    "narration": "Cuando Sarah detecta interés real, solicita los datos de contacto de forma natural y no intrusiva. Me pregunta si me gustaría que un especialista me contacte. Al decir que sí, me pide el nombre y email. En ese momento, Sarah crea automáticamente un lead cualificado con una puntuación basada en la información proporcionada: el nombre vale diez puntos, el email veinte, la empresa quince, y la detección de intención de compra suma veinte puntos extra. La línea de negocio se detecta por el contexto de la conversación. Los datos se envían al CRM configurado en tiempo real y se dispara un webhook con el evento lead creado.",
    "voice": V_FEMALE,
},

# ═══════════════════════════════════════════
# CAPÍTULO 7: CLICK2CALL Y SARAHPHONE
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 7, "chapter_title": "Click2Call & VoIP",
    "content": {"num": 7, "title": "Click2Call y SarahPhone", "subtitle": "Telefonía VoIP integrada en el navegador"},
    "duration": 3.0,
},
{
    "type": "bullets",
    "chapter_num": 7, "chapter_title": "Click2Call & VoIP",
    "content": {
        "title": "SarahPhone: Llamadas desde el Navegador",
        "items": [
            "El visitante hace clic en el botón de llamar directamente desde el widget.",
            "Su navegador solicita permiso para acceder al micrófono y altavoz.",
            "Se establece una conexión WebRTC a través de Janus Gateway.",
            "Janus conecta con la centralita Vozelia Cloud PBX vía protocolo SIP.",
            "La llamada llega al teléfono del agente asignado a esa línea de negocio.",
            "Sin instalar nada. Sin descolgar un teléfono. Directo desde la web.",
        ]
    },
    "narration": "SarahPhone es la función de telefonía integrada de Sarah. Permite al visitante hacer una llamada de voz directamente desde el navegador, sin instalar nada ni descolgar un teléfono. El proceso es simple: el visitante hace clic en el botón de llamar del widget. Su navegador solicita permiso para el micrófono. Se establece una conexión WebRTC a través de Janus Gateway, nuestro relay de medios. Janus conecta con la centralita Vozelia Cloud PBX usando el protocolo SIP. Y la llamada llega directamente al teléfono del agente asignado a esa línea de negocio.",
    "voice": V_MAIN,
},
{
    "type": "code",
    "chapter_num": 7, "chapter_title": "Click2Call & VoIP",
    "content": {
        "title": "Flujo Técnico WebRTC → SIP",
        "desc": "Navegador → Janus Gateway → Vozelia PBX → Agente",
        "code": [
            ("// Widget: SIP.js inicia la llamada", (139, 148, 158)),
            ("const session = userAgent.invite('sip:108@cloudpbx1584.vozelia.com');", (201, 209, 217)),
            ("", (0,0,0)),
            ("// Flujo de señalización:", (139, 148, 158)),
            ("// 1. Browser → WebSocket → Janus Gateway (SDP offer)", C_TEAL),
            ("// 2. Janus   → SIP INVITE → Vozelia PBX", C_BLUE),
            ("// 3. Vozelia → Ring → Extension 107 (agente)", C_GREEN),
            ("// 4. Agente contesta → SDP answer → media bidireccional", C_ORANGE),
            ("", (0,0,0)),
            ("// Extensiones por línea de negocio:", (139, 148, 158)),
            ("//   Boostic (SEO)     → ext. 107 (Claudia)", (201, 209, 217)),
            ("//   Binnacle (BI)     → ext. 158 (David)", (201, 209, 217)),
            ("//   Marketing         → ext. 105 (David casa)", (201, 209, 217)),
            ("//   Tech (Dev)        → ext. 108 (Click2Call)", (201, 209, 217)),
            ("", (0,0,0)),
            ("// Fuera de horario → formulario offline", (255, 123, 114)),
            ("// BUSINESS_HOURS: 9:00 - 19:00 Europe/Madrid", (255, 123, 114)),
        ]
    },
    "narration": "A nivel técnico, el widget usa SIP punto JS para iniciar la llamada. El navegador envía una oferta SDP por WebSocket a Janus Gateway. Janus traduce el WebRTC a SIP y envía un INVITE a la centralita Vozelia. La centralita hace sonar la extensión del agente asignado a esa línea de negocio. Cuando el agente contesta, se establece un canal de audio bidireccional. Cada línea de negocio tiene su propia extensión: Boostic va a la extensión ciento siete, Binnacle a la ciento cincuenta y ocho, y así sucesivamente. Fuera del horario laboral, de nueve a diecinueve horas en zona horaria de Madrid, el botón de llamar se desactiva y se muestra un formulario alternativo.",
    "voice": V_MAIN,
},
{
    "type": "bullets",
    "chapter_num": 7, "chapter_title": "Click2Call & VoIP",
    "content": {
        "title": "Funcionalidades Avanzadas de SarahPhone",
        "items": [
            "Cola de llamadas: si el agente está ocupado, el visitante espera con música.",
            "Grabación de llamadas: opcional, con transcripción automática.",
            "Métricas de calidad de audio: latencia, jitter, pérdida de paquetes en tiempo real.",
            "Callback scheduler: el visitante puede agendar una llamada para más tarde.",
            "AI Caller: agente de voz con IA para llamadas salientes automáticas.",
            "Fuera de horario: formulario offline obligatorio (nombre + email).",
        ]
    },
    "narration": "SarahPhone incluye funcionalidades avanzadas. Cola de llamadas con música de espera cuando el agente está ocupado. Grabación opcional de llamadas con transcripción automática para análisis posterior. Métricas de calidad de audio en tiempo real: latencia, jitter y pérdida de paquetes. Un scheduler de callbacks para que el visitante pueda agendar una llamada para otro momento. Un agente de voz con inteligencia artificial para llamadas salientes automáticas. Y fuera de horario, un formulario offline donde el visitante deja sus datos para ser contactado al día siguiente.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 8: DASHBOARD DE AGENTES
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 8, "chapter_title": "Dashboard",
    "content": {"num": 8, "title": "Dashboard de Agentes", "subtitle": "El centro de operaciones para tu equipo"},
    "duration": 3.0,
},
{
    "type": "split",
    "chapter_num": 8, "chapter_title": "Dashboard",
    "content": {
        "title": "Vista General del Dashboard",
        "text": "El dashboard es una aplicación web profesional con seis secciones principales para gestionar todas las interacciones.",
        "items": [
            "Conversaciones: cola en tiempo real con prioridad y filtros.",
            "Leads: pipeline comercial con scoring y datos de contacto.",
            "Analytics: métricas clave con gráficas interactivas Chart.js.",
            "Llamadas: registro, grabaciones, transcripciones, monitorización.",
            "Training: revisar y mejorar las respuestas de la IA.",
            "Ajustes: tema, respuestas rápidas, webhooks, sistema.",
        ],
        "visual": "dashboard",
        "tab": "queue",
    },
    "narration": "El dashboard de agentes es una aplicación web profesional donde los equipos comerciales y de soporte gestionan todas las interacciones. Tiene seis secciones. Conversaciones muestra en tiempo real todas las conversaciones activas con indicadores de prioridad y tiempo de espera. Leads muestra todos los contactos capturados con su puntuación. Analytics ofrece métricas clave con gráficas interactivas. Llamadas registra todas las llamadas con grabaciones y transcripciones. Training permite revisar y mejorar las respuestas de la inteligencia artificial. Y Ajustes permite personalizar todo sin tocar código.",
    "voice": V_MAIN,
},
{
    "type": "split",
    "chapter_num": 8, "chapter_title": "Dashboard",
    "content": {
        "title": "Chat del Agente con el Visitante",
        "text": "El agente ve el historial completo de la conversación con la IA y puede continuar la atención personalmente.",
        "items": [
            "Historial completo: mensajes del visitante + respuestas de la IA.",
            "Respuestas rápidas: /hola, /precios, /demo → expansión automática.",
            "Información del visitante: idioma, página actual, tiempo en web.",
            "Lead scoring en tiempo real: se actualiza con cada interacción.",
            "Transferencia entre agentes si cambia la línea de negocio.",
            "Notas internas visibles solo para el equipo.",
        ],
        "visual": "dashboard",
        "tab": "queue",
    },
    "narration": "Cuando un agente acepta una conversación, ve el historial completo incluyendo las respuestas que dio la inteligencia artificial. Puede usar respuestas rápidas predefinidas: escribe barra hola y se expande automáticamente al saludo corporativo completo. Escribe barra precios y se envía la lista de precios actualizada. Tiene acceso a la información del visitante: idioma detectado, página desde la que escribió, y tiempo en la web. La puntuación del lead se actualiza en tiempo real con cada interacción. Si la consulta cambia de línea de negocio, puede transferir la conversación a otro agente. Y puede añadir notas internas visibles solo para el equipo.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 9: MULTIIDIOMA
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 9, "chapter_title": "Multiidioma",
    "content": {"num": 9, "title": "Multiidioma", "subtitle": "4 idiomas con detección automática"},
    "duration": 3.0,
},
{
    "type": "bullets",
    "chapter_num": 9, "chapter_title": "Multiidioma",
    "content": {
        "title": "Detección Automática de Idioma",
        "items": [
            "Español (ES): idioma por defecto. Sarah saluda y responde en español.",
            "Inglés (EN): Hello, I need help → Sarah detecta y cambia a inglés automáticamente.",
            "Portugués (PT): Olá, preciso de ajuda → Sarah cambia a portugués.",
            "Gallego (GL): Ola, necesito axuda → Sarah detecta y responde en gallego.",
            "Detección por keywords en el primer mensaje del visitante.",
            "Selector manual de idioma disponible en el widget para cambiar en cualquier momento.",
            "Todas las respuestas de IA, mensajes del sistema y interfaz se adaptan al idioma.",
        ]
    },
    "narration": "Sarah soporta cuatro idiomas con detección automática. Español es el idioma por defecto. Si un visitante escribe en inglés, como Hello I need help, Sarah detecta inmediatamente el idioma y cambia toda la interfaz y las respuestas al inglés. Lo mismo con portugués: Olá, preciso de ajuda. Y con gallego: Ola, necesito axuda. La detección funciona por análisis de palabras clave en el primer mensaje. Además, el visitante puede cambiar manualmente el idioma en cualquier momento usando el selector del widget. Todas las respuestas de la inteligencia artificial, los mensajes del sistema y la interfaz completa se adaptan al idioma seleccionado.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 10: CRM Y WEBHOOKS
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 10, "chapter_title": "Integraciones",
    "content": {"num": 10, "title": "CRM e Integraciones", "subtitle": "Conecta Sarah con tu ecosistema"},
    "duration": 3.0,
},
{
    "type": "grid",
    "chapter_num": 10, "chapter_title": "Integraciones",
    "content": {
        "title": "Integraciones CRM",
        "cols": 2,
        "items": [
            {"icon": "☁️", "label": "Salesforce", "desc": "Crear contactos, oportunidades y actividades automáticamente al capturar un lead", "color": C_BLUE},
            {"icon": "🟠", "label": "HubSpot", "desc": "Sincronizar contactos, deals y notes. Compatible con HubSpot free y premium", "color": C_ORANGE},
            {"icon": "🔵", "label": "Zoho CRM", "desc": "Crear leads, contactos y potenciales. Sincronización bidireccional", "color": C_BLUE},
            {"icon": "🟢", "label": "Pipedrive", "desc": "Crear personas, organizaciones y deals en el pipeline configurado", "color": C_GREEN},
        ]
    },
    "narration": "Sarah se integra con los cuatro CRMs más populares del mercado. Con Salesforce, crea automáticamente contactos, oportunidades y actividades cuando se captura un lead. Con HubSpot, sincroniza contactos, deals y notas, compatible tanto con la versión gratuita como premium. Con Zoho CRM, crea leads y contactos con sincronización bidireccional. Y con Pipedrive, crea personas, organizaciones y deals en el pipeline configurado. La integración es automática: cada vez que Sarah captura un lead o cierra una conversación, los datos se envían al CRM sin intervención manual.",
    "voice": V_MAIN,
},
{
    "type": "bullets",
    "chapter_num": 10, "chapter_title": "Integraciones",
    "content": {
        "title": "Webhooks Firmados con HMAC",
        "items": [
            "Cada webhook se firma con HMAC SHA-256 para garantizar autenticidad.",
            "Eventos: conversation.started, message.new, lead.created, lead.scored",
            "Eventos: agent.joined, agent.left, call.started, call.ended",
            "Eventos: csat.submitted, conversation.closed, escalation.requested",
            "Configuración desde el dashboard: URL destino, secret, eventos a suscribir.",
            "Reintentos automáticos con backoff exponencial si el destino falla.",
        ]
    },
    "narration": "Los webhooks permiten conectar Sarah con cualquier sistema externo. Cada webhook se firma criptográficamente con HMAC SHA-256 para garantizar que proviene realmente de Sarah. Se disparan en más de diez eventos diferentes: cuando se inicia una conversación, cuando llega un nuevo mensaje, cuando se captura un lead, cuando se calcula su puntuación, cuando un agente se une o se va, cuando se inicia o termina una llamada, cuando se completa una encuesta de satisfacción, y cuando se solicita una escalación. La configuración se hace desde el dashboard: URL de destino, clave secreta, y qué eventos suscribir. Incluye reintentos automáticos con backoff exponencial.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 11: CASOS DE USO
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 11, "chapter_title": "Casos de Uso",
    "content": {"num": 11, "title": "Casos de Uso", "subtitle": "Cómo cada equipo aprovecha Sarah"},
    "duration": 3.0,
},
{
    "type": "bullets",
    "chapter_num": 11, "chapter_title": "Casos de Uso",
    "content": {
        "title": "Equipo Comercial",
        "items": [
            "Leads cualificados al llegar cada mañana: puntuación, contexto y datos de contacto.",
            "Priorización automática: los leads calientes aparecen primero en el dashboard.",
            "Historial completo de conversación para preparar el primer contacto.",
            "Click2Call directo desde el dashboard al teléfono del visitante.",
            "Métricas de conversión: de visita web a lead a oportunidad cerrada.",
        ]
    },
    "narration": "Para el equipo comercial, Sarah es un aliado que trabaja las veinticuatro horas. Cualifica leads automáticamente mientras los comerciales duermen. Cuando llegan por la mañana, tienen en su dashboard una lista priorizada de contactos calientes listos para llamar. Cada lead incluye el historial completo de la conversación, la puntuación de interés, y todos los datos de contacto. Pueden iniciar una llamada Click to Call directamente desde el dashboard. Y tienen métricas claras de conversión: desde la visita web hasta el lead, y desde el lead hasta la oportunidad cerrada.",
    "voice": V_MAIN,
},
{
    "type": "bullets",
    "chapter_num": 11, "chapter_title": "Casos de Uso",
    "content": {
        "title": "Soporte Técnico y Marketing",
        "items": [
            "Soporte: Sarah resuelve consultas frecuentes de forma autónoma con la base de conocimiento.",
            "Soporte: Los agentes solo intervienen en consultas complejas, multiplicando su productividad.",
            "Marketing: datos sobre qué preguntan los visitantes, qué buscan, desde qué páginas.",
            "Marketing: segmentación por idioma, línea de negocio e interés detectado.",
            "Dirección: métricas ROI claras. Leads generados, tasa de conversión, coste por lead.",
        ]
    },
    "narration": "Para el equipo de soporte, Sarah resuelve las consultas frecuentes de forma autónoma usando la base de conocimiento. Los agentes solo intervienen en consultas complejas, multiplicando su productividad. Para marketing, Sarah genera datos valiosos: qué preguntan los visitantes, qué buscan, desde qué páginas interactúan, y en qué idioma. Permite segmentar por línea de negocio e interés detectado. Y para la dirección, Sarah aporta métricas de retorno de inversión claras: leads generados, tasa de conversión, y coste por lead comparado con otros canales.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 12: PLUGINS
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 12, "chapter_title": "Plugins",
    "content": {"num": 12, "title": "Plugins y Extensibilidad", "subtitle": "WordPress, Shopify, Magento y API REST"},
    "duration": 3.0,
},
{
    "type": "code",
    "chapter_num": 12, "chapter_title": "Plugins",
    "content": {
        "title": "Plugin WordPress",
        "desc": "Se instala como cualquier plugin. Panel de ajustes incluido.",
        "code": [
            ("// plugins/wordpress/rdgbot.php", (139, 148, 158)),
            ("", (0,0,0)),
            ("class SarahChatbot {", (255, 123, 114)),
            ("  // Hooks de WordPress", (139, 148, 158)),
            ("  add_action('admin_menu', 'add_admin_menu');", (201, 209, 217)),
            ("  add_action('wp_footer',  'render_widget');", (201, 209, 217)),
            ("", (0,0,0)),
            ("  // Settings del admin", (139, 148, 158)),
            ("  register_setting('sarah-chatbot', 'rdgbot_server_url');", (165, 214, 255)),
            ("  register_setting('sarah-chatbot', 'rdgbot_api_key');", (165, 214, 255)),
            ("  register_setting('sarah-chatbot', 'rdgbot_language');", (165, 214, 255)),
            ("  register_setting('sarah-chatbot', 'rdgbot_primary_color');", (165, 214, 255)),
            ("  register_setting('sarah-chatbot', 'rdgbot_position');", (165, 214, 255)),
            ("  register_setting('sarah-chatbot', 'rdgbot_enabled');", (165, 214, 255)),
            ("", (0,0,0)),
            ("  // render_widget() → inyecta window.Sarah + loader.js", (139, 148, 158)),
            ("}", (255, 123, 114)),
        ]
    },
    "narration": "Para WordPress, Sarah incluye un plugin completo. Se instala como cualquier otro plugin, subiéndolo desde el panel de administración. Una vez activado, aparece una sección de ajustes donde configuras la URL del servidor, la clave API, el idioma, el color y la posición del widget. El plugin se engancha al hook wp footer para inyectar automáticamente el objeto window punto Sarah y el script loader punto JS en todas las páginas. Así de sencillo: instalar, configurar URL y color, y listo.",
    "voice": V_MAIN,
},
{
    "type": "bullets",
    "chapter_num": 12, "chapter_title": "Plugins",
    "content": {
        "title": "Shopify, Magento y API REST",
        "items": [
            "Shopify: snippet Liquid en el tema. Configuración desde Theme Settings.",
            "Magento 2: template PHTML que se incluye en el layout XML.",
            "Ambos: instalación en menos de 5 minutos, sin programación.",
            "API REST completa para integraciones personalizadas.",
            "Endpoints: /api/config, /api/chat, /api/leads, /api/agents, /api/calls, /api/analytics.",
            "Autenticación JWT para todas las rutas protegidas.",
        ]
    },
    "narration": "Para Shopify, Sarah se integra mediante un snippet Liquid que se añade al tema, con configuración directa desde Theme Settings. Para Magento dos, mediante un template PHTML incluido en el layout XML. En ambos casos, la instalación toma menos de cinco minutos y no requiere conocimientos de programación. Para integraciones personalizadas, Sarah expone una API REST completa con endpoints para configuración, chat, leads, agentes, llamadas y analytics. Todas las rutas protegidas usan autenticación JWT.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 13: SEGURIDAD
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 13, "chapter_title": "Seguridad",
    "content": {"num": 13, "title": "Seguridad", "subtitle": "Protección de nivel empresarial"},
    "duration": 3.0,
},
{
    "type": "grid",
    "chapter_num": 13, "chapter_title": "Seguridad",
    "content": {
        "title": "Medidas de Seguridad",
        "cols": 3,
        "items": [
            {"icon": "🛡️", "label": "CSRF Protection", "desc": "Tokens anti-falsificación en todas las rutas POST", "color": C_RED},
            {"icon": "🌐", "label": "CORS Validado", "desc": "Solo orígenes autorizados pueden conectar", "color": C_BLUE},
            {"icon": "🔑", "label": "JWT Auth", "desc": "Tokens firmados para agentes y APIs", "color": C_GREEN},
            {"icon": "⏱️", "label": "Rate Limiting", "desc": "Límite de peticiones por IP para prevenir abusos", "color": C_ORANGE},
            {"icon": "🔒", "label": "HMAC Webhooks", "desc": "Firma SHA-256 en cada webhook disparado", "color": C_PURPLE},
            {"icon": "🏰", "label": "Shadow DOM", "desc": "Aislamiento total CSS/JS del widget", "color": C_TEAL},
        ]
    },
    "narration": "La seguridad es prioritaria en Sarah. Protección CSRF con tokens anti-falsificación en todas las rutas POST. Validación de origen CORS estricta, solo los dominios autorizados pueden conectar. Autenticación JWT con tokens firmados para agentes y APIs. Límite de tasa por IP para prevenir abusos y ataques de fuerza bruta. Webhooks firmados con HMAC SHA-256 para garantizar autenticidad. Y Shadow DOM en el widget para aislamiento total del CSS y JavaScript de la página anfitriona, evitando cualquier conflicto o vulnerabilidad de inyección.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 14: PERSONALIZACIÓN
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 14, "chapter_title": "Personalización",
    "content": {"num": 14, "title": "Personalización Total", "subtitle": "Adapta Sarah a tu marca"},
    "duration": 3.0,
},
{
    "type": "bullets",
    "chapter_num": 14, "chapter_title": "Personalización",
    "content": {
        "title": "Tema Completamente Configurable",
        "items": [
            "Colores: primario, secundario, gradientes, fondo, texto, acentos.",
            "Tipografía: familia de fuente, tamaños, pesos para todo el widget.",
            "Layout: posición (4 esquinas), offset, tamaño del widget, border radius.",
            "Branding: nombre empresa, nombre bot, logo, mensaje bienvenida, offline, powered by.",
            "Funciones: activar/desactivar VoIP, upload, emoji, CSAT, lead form, rich messages.",
            "Sonidos: notificación de mensaje, sonido de llamada, sonido de envío.",
            "Horario: días laborables, hora inicio/fin, zona horaria, mensaje fuera de horario.",
            "Todo configurable desde el dashboard sin tocar código.",
        ]
    },
    "narration": "El tema del widget es completamente personalizable. Puedes configurar los colores: primario, secundario, gradientes, fondos y acentos para que coincidan con tu marca. La tipografía completa con fuentes, tamaños y pesos. El layout: posición en cualquiera de las cuatro esquinas, offset, tamaño y radio de bordes. El branding: nombre de empresa, nombre del bot, logo, mensajes de bienvenida y de fuera de horario. Las funciones: activar o desactivar VoIP, subida de archivos, emojis, encuestas de satisfacción, formulario de leads y mensajes enriquecidos. Los sonidos de notificación. Y el horario de atención con zona horaria. Todo se configura desde el dashboard, sin tocar una sola línea de código.",
    "voice": V_MAIN,
},

# ═══════════════════════════════════════════
# CAPÍTULO 15: CIERRE
# ═══════════════════════════════════════════
{
    "type": "chapter",
    "chapter_num": 15, "chapter_title": "Cierre",
    "content": {"num": 15, "title": "Resumen y Próximos Pasos", "subtitle": ""},
    "duration": 3.0,
},
{
    "type": "grid",
    "chapter_num": 15, "chapter_title": "Cierre",
    "content": {
        "title": "Lo que Sarah Ofrece",
        "cols": 3,
        "items": [
            {"icon": "🤖", "label": "Chat IA", "desc": "Claude + Gemini + OpenAI, multiidioma, base de conocimiento", "color": C_TEAL},
            {"icon": "📞", "label": "Click2Call VoIP", "desc": "WebRTC + Janus + SIP, directo desde el navegador", "color": C_GREEN},
            {"icon": "👥", "label": "Dashboard", "desc": "Cola, chat agente, leads, analytics, settings", "color": C_PURPLE},
            {"icon": "🔗", "label": "CRM + Webhooks", "desc": "Salesforce, HubSpot, Zoho, Pipedrive + HMAC events", "color": C_BLUE},
            {"icon": "🔌", "label": "Plugins", "desc": "WordPress, Shopify, Magento + API REST completa", "color": C_ORANGE},
            {"icon": "🛡️", "label": "Enterprise Ready", "desc": "CSRF, CORS, JWT, Shadow DOM, multi-tenant", "color": C_RED},
        ]
    },
    "narration": "Resumamos todo lo que hemos visto. Sarah ofrece un chat con inteligencia artificial multi-proveedor, multiidioma y con base de conocimiento. Telefonía Click to Call y VoIP integrada con WebRTC, Janus Gateway y protocolo SIP, directamente desde el navegador. Un dashboard profesional para agentes con cola de espera, chat, leads, analytics y configuración completa. Integración con los principales CRMs y webhooks firmados con HMAC. Plugins listos para WordPress, Shopify y Magento, más una API REST completa. Y seguridad de nivel empresarial con CSRF, CORS, JWT, Shadow DOM y soporte multi-tenant.",
    "voice": V_MAIN,
},
{
    "type": "bullets",
    "chapter_num": 15, "chapter_title": "Cierre",
    "content": {
        "title": "Próximos Pasos",
        "items": [
            "Despliegue en producción con dominio chatbot.redegal.com y SSL.",
            "Configuración de extensiones telefónicas reales por línea de negocio.",
            "Integración con el CRM corporativo de la empresa.",
            "Alimentar la base de conocimiento con documentos de cada área.",
            "Formación del equipo comercial y de soporte en el dashboard.",
            "Medición de KPIs: leads/mes, tasa conversión, CSAT, tiempo respuesta.",
        ]
    },
    "narration": "Los próximos pasos para poner Sarah en producción incluyen: desplegar con dominio propio y certificado SSL. Configurar las extensiones telefónicas reales para cada línea de negocio. Integrar con el CRM corporativo. Alimentar la base de conocimiento con los documentos reales de cada área. Formar al equipo comercial y de soporte en el uso del dashboard. Y establecer KPIs claros: leads generados por mes, tasa de conversión, puntuación de satisfacción y tiempo medio de respuesta.",
    "voice": V_MAIN,
},
{
    "type": "title",
    "chapter_num": 15, "chapter_title": "Cierre",
    "content": {
        "tag": "REDEGAL",
        "title": "Sarah",
        "subtitle": "Transforma cada visita en una oportunidad · redegal.com"
    },
    "narration": "Sarah es una pieza central en la estrategia digital de Redegal. Transforma cada visita en una oportunidad, cada conversación en un dato, y cada contacto en un potencial cliente. Gracias por ver este vídeo. Para más información, visita redegal punto com o contacta directamente con nuestro equipo.",
    "voice": V_MAIN,
},

]  # End SLIDES
