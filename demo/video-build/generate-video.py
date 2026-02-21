#!/usr/bin/env python3
"""
Redegal Chatbot — Demo Video Generator
Generates MP4 with Microsoft Edge TTS voices + animated slides via ffmpeg.

3 voices:
  - Narrator (Alvaro, rate -5%): explains the system
  - Agent/David (Alvaro, rate +0%, pitch +2Hz): commercial agent
  - Lead/María (Elvira, rate +0%): website visitor / lead

3 call scenes with bidirectional dialogue:
  1. Chat flow + AI response
  2. WebRTC call: browser → Janus → PBX → agent phone
  3. Click2Call callback: server calls visitor phone → transfers to agent
"""

import asyncio
import subprocess
import os
import json
import math

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio")
SLIDES_DIR = os.path.join(os.path.dirname(__file__), "slides")
OUTPUT_DIR = os.path.dirname(os.path.dirname(__file__))
OUTPUT_FILE = os.path.expanduser("~/Downloads/redegal-chatbot-demo.mp4")

os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(SLIDES_DIR, exist_ok=True)

# ─── Voice Configuration ───
VOICES = {
    "narrator": {"voice": "es-ES-AlvaroNeural", "rate": "-5%", "pitch": "-2Hz"},
    "agent":    {"voice": "es-ES-AlvaroNeural", "rate": "+0%", "pitch": "+3Hz"},
    "lead":     {"voice": "es-ES-ElviraNeural", "rate": "+0%", "pitch": "+0Hz"},
}

# ─── Script: each segment = (speaker, text, slide_id) ───
SCRIPT = [
    # ── ACT 1: Introduction ──
    ("narrator", "Bienvenidos a la demostración del sistema de comunicaciones inteligente de Redegal.", "title"),
    ("narrator", "Veremos las dos formas de llamada: desde el navegador con WebRTC, y mediante callback telefónico con Click to Call.", "title"),

    ("narrator", "El sistema tiene una arquitectura moderna. El widget se integra en cualquier web. El servidor gestiona la inteligencia artificial, las llamadas y los leads.", "architecture"),
    ("narrator", "Para las llamadas desde el navegador, utilizamos Janus Gateway como puente entre WebRTC y el protocolo SIP. La PBX de Vozelia Cloud gestiona las extensiones de los agentes comerciales.", "architecture"),

    ("narrator", "El stack tecnológico incluye: Node punto JS con Express, React para el widget, PostgreSQL con pgvector para embeddings, Redis para tiempo real, y Docker para el despliegue.", "techstack"),

    # ── ACT 2: Chat Flow ──
    ("narrator", "Veamos el flujo completo. Un visitante llega a redegal punto com y abre el chatbot.", "chat_open"),

    ("lead", "Hola, necesito información sobre servicios SEO para mi empresa de comercio electrónico.", "chat_msg1"),

    ("narrator", "La inteligencia artificial detecta automáticamente la línea de negocio Boostic, y responde con información contextual del knowledge base.", "chat_ai"),

    ("narrator", "El bot ofrece opciones enriquecidas: hablar con un experto, dejar datos, o llamar directamente. El visitante elige llamar.", "chat_cta"),

    # ── ACT 3: WebRTC Call ──
    ("narrator", "Primera opción: Llamar desde el navegador. El visitante pulsa el botón Llamar desde el navegador.", "webrtc_choose"),

    ("narrator", "El sistema verifica el micrófono, la conexión de red y el servidor de Janus. Tres checks verdes.", "webrtc_preflight"),

    ("narrator", "La llamada se establece. El navegador se conecta por WebSocket a Janus Gateway. Janus traduce WebRTC a SIP y envía un INVITE a la PBX de Vozelia. La extensión del agente empieza a sonar.", "webrtc_calling"),

    ("narrator", "Conexión establecida. Escuchemos la conversación entre el comercial David y la lead María.", "webrtc_connected"),

    ("agent", "Hola, soy David del equipo de Boostic en Redegal. ¿En qué puedo ayudarle?", "webrtc_call_1"),
    ("lead", "Hola David, tenemos una tienda online de moda y necesitamos mejorar nuestro posicionamiento en Google.", "webrtc_call_1"),
    ("agent", "Perfecto, tenemos mucha experiencia en SEO para ecommerce. ¿Cuál es su facturación mensual aproximada?", "webrtc_call_2"),
    ("lead", "Estamos facturando unos cincuenta mil euros al mes, pero sabemos que podemos crecer mucho más.", "webrtc_call_2"),
    ("agent", "Excelente, con ese volumen podemos conseguir resultados muy significativos. Le prepararé una propuesta personalizada esta misma semana.", "webrtc_call_3"),
    ("lead", "Genial. Mi email es maría punto garcía arroba moda demo punto com.", "webrtc_call_3"),
    ("agent", "Perfecto María, le enviaré la propuesta mañana. Ha sido un placer hablar con usted.", "webrtc_call_4"),
    ("lead", "Igualmente David, muchas gracias.", "webrtc_call_4"),

    ("narrator", "La llamada finaliza. Duración: tres minutos y cuarenta y siete segundos. Calidad de audio excelente con un MOS de cuatro punto dos.", "webrtc_ended"),
    ("narrator", "La grabación se almacena automáticamente y se transcribe con inteligencia artificial. Retención de treinta días.", "webrtc_ended"),

    # ── ACT 4: Click2Call Callback ──
    ("narrator", "Segunda opción: Callback telefónico, o Click to Call. Ahora el visitante introduce su número de teléfono.", "callback_phone"),

    ("narrator", "El servidor envía un INVITE SIP al teléfono del visitante a través de la PBX de Vozelia. El teléfono del visitante empieza a sonar.", "callback_invite"),

    ("narrator", "El visitante contesta. El servidor envía un REFER SIP para transferir la llamada al agente comercial. La PBX conecta ambas partes.", "callback_transfer"),

    ("narrator", "Escuchemos esta segunda conversación de callback.", "callback_connected"),

    ("agent", "Buenos días, le llamo desde Redegal. He visto que tiene interés en nuestros servicios de marketing digital.", "callback_call_1"),
    ("lead", "Sí, exacto. Necesitamos ayuda con campañas en Google Ads y redes sociales.", "callback_call_1"),
    ("agent", "Nuestro equipo de marketing digital tiene más de diez años de experiencia en SEM y Social Ads. ¿Tienen un presupuesto mensual definido?", "callback_call_2"),
    ("lead", "Estamos pensando en invertir entre tres mil y cinco mil euros mensuales.", "callback_call_2"),
    ("agent", "Con ese presupuesto podemos diseñar una estrategia muy efectiva. Puedo agendar una reunión con nuestro director de marketing para la próxima semana.", "callback_call_3"),
    ("lead", "Me parece perfecto. El martes por la mañana me viene bien.", "callback_call_3"),
    ("agent", "Quedamos el martes a las diez. Le envío confirmación por email. Muchas gracias por su interés.", "callback_call_4"),

    ("narrator", "Ambas llamadas quedan registradas en el dashboard con grabación, duración y transcripción automática.", "callback_ended"),

    # ── ACT 5: Dashboard & Features ──
    ("narrator", "En el dashboard, los agentes ven todas las conversaciones, llamadas, leads y analíticas en tiempo real.", "dashboard"),

    ("narrator", "El sistema notifica al comercial cuando hay un lead esperando, mediante Redis pub sub en tiempo real, notificaciones push y email.", "dashboard_leads"),

    ("narrator", "Las grabaciones se transcriben con inteligencia artificial. El sistema aprende de cada interacción para mejorar las respuestas del bot.", "ai_learning"),

    ("narrator", "El sistema soporta múltiples usuarios simultáneos. Cada visitante tiene su propia sesión WebSocket, con rate limiting y cola de agentes.", "concurrency"),

    # ── ACT 6: Closing ──
    ("narrator", "Redegal Chatbot: inteligencia artificial multiproveedor, llamadas WebRTC y callback con grabación, cuatro idiomas, integración CRM, y dashboard profesional.", "summary"),
    ("narrator", "Todo listo para producción. Multi-tenant, personalizable, y desplegable con un solo comando de Docker. Gracias por ver esta demostración.", "closing"),
]


# ─── Slide Generator (SVG → PNG via ffmpeg) ───

SLIDE_TEMPLATES = {
    "title": {
        "bg": "#0a0a0f",
        "elements": [
            {"type": "rect", "x": 0, "y": 0, "w": 1920, "h": 1080, "fill": "url(#bg_grad)"},
            {"type": "text", "x": 960, "y": 340, "text": "Redegal Chatbot", "size": 84, "weight": 900, "fill": "#00d4aa"},
            {"type": "text", "x": 960, "y": 440, "text": "WebRTC + Click2Call Demo", "size": 48, "weight": 600, "fill": "#ffffff"},
            {"type": "text", "x": 960, "y": 520, "text": "Llamadas desde el navegador y callback telefónico con grabación", "size": 24, "fill": "#94a3b8"},
            {"type": "text", "x": 960, "y": 750, "text": "🎙 Con voces Microsoft Edge TTS", "size": 20, "fill": "#64748b"},
        ]
    },
    "architecture": {
        "bg": "#0a0a0f",
        "elements": [
            {"type": "rect", "x": 0, "y": 0, "w": 1920, "h": 1080, "fill": "url(#bg_grad)"},
            {"type": "text", "x": 960, "y": 80, "text": "Arquitectura del Sistema", "size": 44, "weight": 800, "fill": "#00d4aa"},
            {"type": "text", "x": 480, "y": 220, "text": "MODO 1 — WebRTC (Navegador)", "size": 28, "weight": 700, "fill": "#3b82f6"},
            {"type": "text", "x": 480, "y": 280, "text": "Widget ──WebSocket──► Janus Gateway ──SIP/UDP──► Vozelia PBX", "size": 20, "fill": "#e2e8f0", "font": "monospace"},
            {"type": "text", "x": 480, "y": 320, "text": "(browser WebRTC)        (Docker)              (cloud PBX)", "size": 16, "fill": "#64748b", "font": "monospace"},
            {"type": "text", "x": 480, "y": 430, "text": "MODO 2 — Click2Call (Callback)", "size": 28, "weight": 700, "fill": "#10b981"},
            {"type": "text", "x": 480, "y": 490, "text": "Widget ──WS──► Server ──SIP INVITE──► Teléfono Visitante", "size": 20, "fill": "#e2e8f0", "font": "monospace"},
            {"type": "text", "x": 480, "y": 530, "text": "                        ──SIP REFER──► Extensión Agente", "size": 20, "fill": "#e2e8f0", "font": "monospace"},
            {"type": "text", "x": 480, "y": 640, "text": "GRABACIÓN (ambos modos)", "size": 28, "weight": 700, "fill": "#f59e0b"},
            {"type": "text", "x": 480, "y": 700, "text": "Janus graba RTP → .mjr/.wav → Transcripción IA → 30 días retención", "size": 20, "fill": "#e2e8f0", "font": "monospace"},
        ]
    },
    "techstack": {
        "bg": "#0a0a0f",
        "elements": [
            {"type": "rect", "x": 0, "y": 0, "w": 1920, "h": 1080, "fill": "url(#bg_grad)"},
            {"type": "text", "x": 960, "y": 100, "text": "Stack Tecnológico", "size": 44, "weight": 800, "fill": "#00d4aa"},
            {"type": "text", "x": 400, "y": 250, "text": "⚡ Node.js 20 + Express", "size": 28, "fill": "#e2e8f0"},
            {"type": "text", "x": 400, "y": 320, "text": "⚛️ React 19 + TypeScript + Tailwind", "size": 28, "fill": "#e2e8f0"},
            {"type": "text", "x": 400, "y": 390, "text": "🐘 PostgreSQL 16 + pgvector", "size": 28, "fill": "#e2e8f0"},
            {"type": "text", "x": 400, "y": 460, "text": "🔴 Redis 7 (pub/sub + sessions)", "size": 28, "fill": "#e2e8f0"},
            {"type": "text", "x": 400, "y": 530, "text": "🌐 Janus WebRTC Gateway", "size": 28, "fill": "#3b82f6"},
            {"type": "text", "x": 400, "y": 600, "text": "📞 Vozelia Cloud PBX (SIP/UDP)", "size": 28, "fill": "#10b981"},
            {"type": "text", "x": 400, "y": 670, "text": "🤖 IA: Claude + Gemini + OpenAI", "size": 28, "fill": "#f59e0b"},
            {"type": "text", "x": 400, "y": 740, "text": "🐳 Docker Compose (1 comando)", "size": 28, "fill": "#e2e8f0"},
            {"type": "text", "x": 400, "y": 810, "text": "🌍 4 idiomas: ES, EN, PT, GL", "size": 28, "fill": "#e2e8f0"},
        ]
    },
    "chat_open": {
        "bg": "#0a0a0f",
        "elements": [
            {"type": "rect", "x": 0, "y": 0, "w": 1920, "h": 1080, "fill": "url(#bg_grad)"},
            {"type": "text", "x": 960, "y": 100, "text": "💬 Chat con IA", "size": 44, "weight": 800, "fill": "#00d4aa"},
            {"type": "text", "x": 960, "y": 180, "text": "El visitante abre el widget en redegal.com", "size": 24, "fill": "#94a3b8"},
            # Widget mockup
            {"type": "rect", "x": 660, "y": 240, "w": 600, "h": 700, "rx": 20, "fill": "#1e293b", "stroke": "#334155"},
            {"type": "rect", "x": 660, "y": 240, "w": 600, "h": 80, "rx": "20 20 0 0", "fill": "#007fff"},
            {"type": "text", "x": 960, "y": 290, "text": "Redegal ● Online", "size": 20, "weight": 700, "fill": "#ffffff"},
            {"type": "text", "x": 960, "y": 500, "text": "👋", "size": 48, "fill": "#ffffff"},
            {"type": "text", "x": 960, "y": 570, "text": "¡Hola! ¿En qué podemos ayudarte?", "size": 22, "weight": 600, "fill": "#ffffff"},
            {"type": "text", "x": 960, "y": 620, "text": "Elige tu área de interés:", "size": 16, "fill": "#94a3b8"},
            {"type": "rect", "x": 720, "y": 660, "w": 240, "h": 50, "rx": 12, "fill": "#3b82f620", "stroke": "#3b82f6"},
            {"type": "text", "x": 840, "y": 690, "text": "📈 Boostic", "size": 16, "fill": "#3b82f6"},
            {"type": "rect", "x": 980, "y": 660, "w": 240, "h": 50, "rx": 12, "fill": "#8b5cf620", "stroke": "#8b5cf6"},
            {"type": "text", "x": 1100, "y": 690, "text": "📊 Binnacle", "size": 16, "fill": "#8b5cf6"},
            {"type": "rect", "x": 720, "y": 730, "w": 240, "h": 50, "rx": 12, "fill": "#10b98120", "stroke": "#10b981"},
            {"type": "text", "x": 840, "y": 760, "text": "📣 Marketing", "size": 16, "fill": "#10b981"},
            {"type": "rect", "x": 980, "y": 730, "w": 240, "h": 50, "rx": 12, "fill": "#f59e0b20", "stroke": "#f59e0b"},
            {"type": "text", "x": 1100, "y": 760, "text": "💻 Tech", "size": 16, "fill": "#f59e0b"},
        ]
    },
}

# Default slide for any unspecified slide_id
DEFAULT_SLIDE = {
    "bg": "#0a0a0f",
    "elements": [
        {"type": "rect", "x": 0, "y": 0, "w": 1920, "h": 1080, "fill": "url(#bg_grad)"},
    ]
}

# Dynamic slides based on slide_id patterns
DYNAMIC_SLIDES = {
    "chat_msg1": ("💬 Visitante escribe...", "Necesito información sobre servicios SEO", "#3b82f6"),
    "chat_ai": ("🤖 IA responde", "Detección automática: Línea Boostic (SEO/Growth)", "#00d4aa"),
    "chat_cta": ("📋 Opciones enriquecidas", "📞 Llamar  •  💬 Hablar con experto  •  📝 Dejar datos", "#6c5ce7"),
    "webrtc_choose": ("📱 Elegir modo de llamada", "🖥 Llamar desde el navegador  |  📞 Que me llamen", "#3b82f6"),
    "webrtc_preflight": ("✅ Verificación preflight", "✓ Micrófono  ✓ Conexión  ✓ Servidor Janus", "#10b981"),
    "webrtc_calling": ("📡 Llamando via WebRTC...", "Browser → Janus Gateway → SIP → Vozelia PBX → Ext. 107", "#3b82f6"),
    "webrtc_connected": ("🟢 Llamada WebRTC conectada", "Duración: en curso  •  Calidad: Excelente (MOS 4.2)", "#10b981"),
    "webrtc_call_1": ("🟢 WebRTC — Conversación", "David (Agente Boostic) ↔ María (Lead)", "#10b981"),
    "webrtc_call_2": ("🟢 WebRTC — Conversación", "Descubrimiento de necesidades del cliente", "#10b981"),
    "webrtc_call_3": ("🟢 WebRTC — Conversación", "Propuesta y captura de datos", "#10b981"),
    "webrtc_call_4": ("🟢 WebRTC — Conversación", "Cierre de la llamada", "#10b981"),
    "webrtc_ended": ("✅ Llamada WebRTC finalizada", "Duración: 03:47  •  MOS: 4.2  •  Grabación ✓  •  Transcripción IA ✓", "#10b981"),
    "callback_phone": ("📞 Click2Call — Introducir teléfono", "Visitante introduce: +34 612 345 678", "#f59e0b"),
    "callback_invite": ("📡 SIP INVITE enviado", "Server → Vozelia PBX → Teléfono visitante sonando...", "#f59e0b"),
    "callback_transfer": ("🔄 Transferencia SIP REFER", "Visitante contesta → REFER a extensión agente → Conectados", "#f59e0b"),
    "callback_connected": ("🟢 Callback conectado", "Llamada bidireccional: Agente ↔ Visitante", "#10b981"),
    "callback_call_1": ("🟢 Callback — Conversación", "Agente contacta al lead por teléfono", "#10b981"),
    "callback_call_2": ("🟢 Callback — Conversación", "Descubrimiento de presupuesto", "#10b981"),
    "callback_call_3": ("🟢 Callback — Conversación", "Agendar reunión con director", "#10b981"),
    "callback_call_4": ("🟢 Callback — Conversación", "Confirmación y cierre", "#10b981"),
    "callback_ended": ("✅ Ambas llamadas registradas", "Dashboard: WebRTC + Callback  •  Grabaciones  •  Transcripciones", "#10b981"),
    "dashboard": ("📊 Dashboard de Agentes", "Conversaciones  •  Llamadas  •  Leads  •  Analíticas  •  Wallboard", "#6c5ce7"),
    "dashboard_leads": ("🔔 Notificaciones en tiempo real", "Redis pub/sub → Dashboard → Email → Push notification", "#f59e0b"),
    "ai_learning": ("🧠 IA que aprende", "CSAT → Training data → Mejora continua → Knowledge base auto-scraping", "#00d4aa"),
    "concurrency": ("⚡ Concurrencia multi-usuario", "WebSocket por visitante  •  Rate limiting  •  Cola de agentes  •  Redis sessions", "#3b82f6"),
    "summary": ("🚀 Redegal Chatbot", "IA + WebRTC + Click2Call + Grabación + 4 idiomas + CRM + Dashboard", "#00d4aa"),
    "closing": ("Gracias", "redegal.com  •  Powered by Redegal Digital Tech", "#00d4aa"),
}


def generate_svg(slide_id, speaker=None, text=None):
    """Generate an SVG slide image."""
    tmpl = SLIDE_TEMPLATES.get(slide_id)

    if tmpl:
        return render_template_svg(tmpl)

    # Dynamic slide
    info = DYNAMIC_SLIDES.get(slide_id, (slide_id, "", "#00d4aa"))
    title, subtitle, color = info

    # Add speaker indicator
    speaker_label = ""
    if speaker == "agent":
        speaker_label = "🎤 David (Agente)"
        speaker_color = "#3b82f6"
    elif speaker == "lead":
        speaker_label = "🎤 María (Lead)"
        speaker_color = "#ec4899"
    elif speaker == "narrator":
        speaker_label = ""
        speaker_color = "#94a3b8"

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="bg_grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a1a"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00d4aa"/>
      <stop offset="100%" stop-color="#6c5ce7"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg_grad)"/>

  <!-- Decorative circles -->
  <circle cx="200" cy="200" r="300" fill="{color}" opacity="0.03"/>
  <circle cx="1700" cy="800" r="400" fill="#6c5ce7" opacity="0.03"/>

  <!-- Top accent line -->
  <rect x="860" y="60" width="200" height="4" rx="2" fill="url(#accent)" opacity="0.6"/>

  <!-- Title -->
  <text x="960" y="380" text-anchor="middle" font-family="Inter, system-ui, sans-serif"
        font-size="52" font-weight="800" fill="{color}">{escape_svg(title)}</text>

  <!-- Subtitle -->
  <text x="960" y="460" text-anchor="middle" font-family="Inter, system-ui, sans-serif"
        font-size="28" fill="#e2e8f0" opacity="0.8">{escape_svg(subtitle)}</text>

  <!-- Speaker indicator -->
  {f'<rect x="760" y="560" width="400" height="50" rx="25" fill="{speaker_color}" opacity="0.15"/>' if speaker_label else ''}
  {f'<text x="960" y="592" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="22" fill="{speaker_color}" font-weight="600">{escape_svg(speaker_label)}</text>' if speaker_label else ''}

  <!-- Current speech text -->
  {f'<text x="960" y="680" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="22" fill="#94a3b8" font-style="italic" opacity="0.7">&quot;{escape_svg(text[:80] if text else "")}&quot;</text>' if text and speaker != "narrator" else ''}

  <!-- Branding -->
  <text x="960" y="1020" text-anchor="middle" font-family="Inter, system-ui, sans-serif"
        font-size="16" fill="#475569">Redegal Chatbot — WebRTC + Click2Call Demo</text>
</svg>'''
    return svg


def render_template_svg(tmpl):
    """Render a template-based SVG."""
    elements_svg = ""
    for el in tmpl.get("elements", []):
        if el["type"] == "rect":
            rx = el.get("rx", 0)
            stroke = f' stroke="{el["stroke"]}" stroke-width="1"' if el.get("stroke") else ""
            elements_svg += f'  <rect x="{el["x"]}" y="{el["y"]}" width="{el["w"]}" height="{el["h"]}" rx="{rx}" fill="{el["fill"]}"{stroke}/>\n'
        elif el["type"] == "text":
            font = el.get("font", "Inter, system-ui, sans-serif")
            weight = el.get("weight", 400)
            anchor = el.get("anchor", "middle")
            if el.get("font") == "monospace":
                font = "JetBrains Mono, monospace"
                anchor = "start"
            elements_svg += f'  <text x="{el["x"]}" y="{el["y"]}" text-anchor="{anchor}" font-family="{font}" font-size="{el["size"]}" font-weight="{weight}" fill="{el["fill"]}">{escape_svg(el["text"])}</text>\n'

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="bg_grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a1a"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#0a0a1a"/>
    </linearGradient>
  </defs>
{elements_svg}
  <text x="960" y="1020" text-anchor="middle" font-family="Inter, system-ui, sans-serif"
        font-size="16" fill="#475569">Redegal Chatbot — WebRTC + Click2Call Demo</text>
</svg>'''
    return svg


def escape_svg(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


async def generate_audio(index, speaker, text):
    """Generate audio file using edge-tts."""
    voice_cfg = VOICES[speaker]
    outfile = os.path.join(AUDIO_DIR, f"{index:03d}.mp3")

    cmd = [
        "python3", "-m", "edge_tts",
        "--voice", voice_cfg["voice"],
        "--rate", voice_cfg["rate"],
        "--pitch", voice_cfg["pitch"],
        "--text", text,
        "--write-media", outfile,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.wait()

    if not os.path.exists(outfile):
        print(f"  ⚠ Failed to generate audio for segment {index}")
        # Create 2s silence as fallback
        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
            "-t", "2", "-q:a", "9", outfile
        ], capture_output=True)

    return outfile


def get_audio_duration(filepath):
    """Get duration of audio file in seconds."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", filepath],
        capture_output=True, text=True
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 2.0


async def main():
    print("🎬 Redegal Chatbot — Video Generator")
    print("=" * 50)

    # Step 1: Generate all audio segments
    print("\n🎙 Generating audio with Microsoft Edge TTS...")
    audio_files = []
    for i, (speaker, text, slide_id) in enumerate(SCRIPT):
        print(f"  [{i+1}/{len(SCRIPT)}] {speaker}: {text[:50]}...")
        audio_file = await generate_audio(i, speaker, text)
        duration = get_audio_duration(audio_file)
        audio_files.append({"file": audio_file, "duration": duration, "speaker": speaker, "text": text, "slide_id": slide_id})

    # Step 2: Generate slide images
    print("\n🎨 Generating slide images...")
    seen_slides = set()
    for i, seg in enumerate(audio_files):
        slide_id = seg["slide_id"]
        slide_key = f"{slide_id}_{seg['speaker']}_{i}"
        svg_content = generate_svg(slide_id, seg["speaker"], seg["text"])
        svg_path = os.path.join(SLIDES_DIR, f"{i:03d}.svg")
        png_path = os.path.join(SLIDES_DIR, f"{i:03d}.png")

        with open(svg_path, "w") as f:
            f.write(svg_content)

        # Convert SVG to PNG using ffmpeg
        subprocess.run([
            "ffmpeg", "-y", "-i", svg_path, "-vf", "scale=1920:1080",
            png_path
        ], capture_output=True)

        if not os.path.exists(png_path):
            # Fallback: create solid color frame
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i",
                "color=c=#0a0a1a:s=1920x1080:d=1",
                "-frames:v", "1", png_path
            ], capture_output=True)

        seg["image"] = png_path
        print(f"  [{i+1}/{len(audio_files)}] Slide: {slide_id} ({seg['duration']:.1f}s)")

    # Step 3: Build ffmpeg concat file
    print("\n🔧 Building video segments...")
    segments_file = os.path.join(SLIDES_DIR, "segments.txt")

    # Create individual video segments for each audio clip
    segment_files = []
    for i, seg in enumerate(audio_files):
        seg_video = os.path.join(SLIDES_DIR, f"seg_{i:03d}.mp4")
        duration = seg["duration"] + 0.5  # Add 0.5s padding

        subprocess.run([
            "ffmpeg", "-y",
            "-loop", "1", "-i", seg["image"],
            "-i", seg["file"],
            "-c:v", "libx264", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-t", str(duration),
            "-shortest",
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#0a0a1a",
            seg_video
        ], capture_output=True)

        if os.path.exists(seg_video):
            segment_files.append(seg_video)
            print(f"  [{i+1}/{len(audio_files)}] Segment: {seg['duration']:.1f}s")
        else:
            print(f"  ⚠ Failed to create segment {i}")

    # Step 4: Concatenate all segments
    print("\n🎬 Concatenating final video...")
    concat_list = os.path.join(SLIDES_DIR, "concat.txt")
    with open(concat_list, "w") as f:
        for seg_file in segment_files:
            f.write(f"file '{seg_file}'\n")

    subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_list,
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        OUTPUT_FILE
    ], capture_output=True)

    if os.path.exists(OUTPUT_FILE):
        size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
        total_duration = sum(s["duration"] for s in audio_files)
        print(f"\n✅ Video generated: {OUTPUT_FILE}")
        print(f"   Duration: ~{total_duration:.0f}s ({total_duration/60:.1f} min)")
        print(f"   Size: {size_mb:.1f} MB")
        print(f"   Resolution: 1920x1080")
    else:
        print("\n❌ Video generation failed!")

    # Cleanup
    print("\n🧹 Cleanup temporary files...")
    # Keep audio and slides for debugging


if __name__ == "__main__":
    asyncio.run(main())
