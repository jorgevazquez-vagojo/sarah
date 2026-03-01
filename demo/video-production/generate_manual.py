#!/usr/bin/env python3
"""
Sarah — Manual Profesional en PDF
Genera manual completo con branding Redegal
"""

from fpdf import FPDF
from pathlib import Path
import os, textwrap

OUTPUT = Path.home() / "Downloads" / "Sarah-Manual-Profesional.pdf"

# Colors
TEAL = (0, 212, 170)
PURPLE = (108, 92, 231)
DARK = (10, 10, 26)
WHITE = (255, 255, 255)
LIGHT = (240, 240, 245)
GRAY = (100, 116, 139)
BLUE = (59, 130, 246)
GREEN = (16, 185, 129)
RED = (227, 6, 19)


class SarahPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=25)
        # Register Unicode fonts
        font_dir = "/System/Library/Fonts/Supplemental/"
        self.add_font("Arial", "", font_dir + "Arial.ttf", uni=True)
        self.add_font("Arial", "B", font_dir + "Arial Bold.ttf", uni=True)
        self.add_font("Arial", "I", font_dir + "Arial Italic.ttf", uni=True)
        self.add_font("Arial", "BI", font_dir + "Arial Bold Italic.ttf", uni=True)
        self.add_font("CourierNew", "", font_dir + "Courier New.ttf", uni=True)
        self.add_font("CourierNew", "B", font_dir + "Courier New Bold.ttf", uni=True)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Arial", "B", 9)
        self.set_text_color(*GRAY)
        self.cell(0, 10, "Sarah — Manual Profesional", align="L")
        self.cell(0, 10, f"Redegal · {self.page_no()}", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*TEAL)
        self.set_line_width(0.5)
        self.line(10, 18, 200, 18)
        self.ln(5)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-15)
        self.set_font("Arial", "I", 8)
        self.set_text_color(*GRAY)
        self.cell(0, 10, f"Sarah — Asistente Inteligente para tu Web  |  redegal.com  |  Pag {self.page_no()}", align="C")

    def cover_page(self):
        self.add_page()
        # Dark background
        self.set_fill_color(*DARK)
        self.rect(0, 0, 210, 297, "F")
        # Teal accent bar
        self.set_fill_color(*TEAL)
        self.rect(0, 100, 210, 4, "F")
        # Title
        self.set_font("Arial", "B", 48)
        self.set_text_color(*WHITE)
        self.set_y(55)
        self.cell(0, 20, "Sarah", align="C", new_x="LMARGIN", new_y="NEXT")
        # Subtitle
        self.set_font("Arial", "", 18)
        self.set_text_color(*TEAL)
        self.cell(0, 12, "Manual Profesional", align="C", new_x="LMARGIN", new_y="NEXT")
        # Description
        self.set_y(115)
        self.set_font("Arial", "", 14)
        self.set_text_color(*LIGHT)
        self.cell(0, 10, "Asistente Inteligente para tu Web", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 10, "Chat IA  ·  Click2Call VoIP  ·  WebRTC  ·  Dashboard Agentes", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 10, "CRM  ·  Webhooks  ·  Multiidioma  ·  Plugins", align="C", new_x="LMARGIN", new_y="NEXT")
        # Version
        self.set_y(200)
        self.set_font("Arial", "", 12)
        self.set_text_color(*GRAY)
        self.cell(0, 8, "Version 1.0  ·  Febrero 2026", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 8, "Redegal S.A. · BME:RDG", align="C", new_x="LMARGIN", new_y="NEXT")
        # Purple bar bottom
        self.set_fill_color(*PURPLE)
        self.rect(0, 293, 210, 4, "F")

    def chapter_title(self, num, title):
        self.add_page()
        # Chapter header with teal bar
        self.set_fill_color(*TEAL)
        self.rect(10, 25, 4, 20, "F")
        self.set_font("Arial", "B", 28)
        self.set_text_color(*DARK)
        self.set_y(25)
        self.set_x(20)
        self.cell(0, 12, f"{num}. {title}", new_x="LMARGIN", new_y="NEXT")
        self.ln(10)

    def section(self, title):
        self.ln(4)
        self.set_font("Arial", "B", 14)
        self.set_text_color(*DARK)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*TEAL)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), 80, self.get_y())
        self.ln(4)

    def body(self, text):
        self.set_font("Arial", "", 11)
        self.set_text_color(60, 60, 60)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def bullet_list(self, items):
        self.set_font("Arial", "", 11)
        self.set_text_color(60, 60, 60)
        for item in items:
            x = self.get_x()
            self.set_x(x + 4)
            self.set_font("Arial", "B", 11)
            self.set_text_color(*TEAL)
            self.cell(6, 6, chr(8226))
            self.set_font("Arial", "", 11)
            self.set_text_color(60, 60, 60)
            self.multi_cell(0, 6, f"  {item}")
            self.ln(1)
        self.ln(2)

    def code_block(self, code, lang=""):
        self.set_fill_color(245, 245, 250)
        self.set_draw_color(200, 200, 210)
        self.set_font("CourierNew", "", 9)
        self.set_text_color(40, 40, 40)
        lines = code.strip().split("\n")
        h = len(lines) * 5 + 6
        y = self.get_y()
        if y + h > 270:
            self.add_page()
            y = self.get_y()
        self.rect(12, y, 186, h, "DF")
        self.set_y(y + 3)
        for line in lines:
            self.set_x(15)
            self.cell(0, 5, line[:95], new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

    def info_box(self, title, text, color=TEAL):
        y = self.get_y()
        if y > 255:
            self.add_page()
            y = self.get_y()
        self.set_fill_color(color[0]//10, color[1]//10, color[2]//10)
        self.set_fill_color(240, 250, 248)
        h = 20 + len(text)//80 * 6
        self.rect(12, y, 186, h, "F")
        self.set_fill_color(*color)
        self.rect(12, y, 3, h, "F")
        self.set_xy(18, y + 3)
        self.set_font("Arial", "B", 11)
        self.set_text_color(*color)
        self.cell(0, 6, title, new_x="LMARGIN", new_y="NEXT")
        self.set_x(18)
        self.set_font("Arial", "", 10)
        self.set_text_color(60, 60, 60)
        self.multi_cell(175, 5, text)
        self.ln(4)

    def table(self, headers, rows, col_widths=None):
        if col_widths is None:
            col_widths = [190 // len(headers)] * len(headers)
        # Header
        self.set_fill_color(*DARK)
        self.set_text_color(*WHITE)
        self.set_font("Arial", "B", 10)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 8, h, border=1, fill=True, align="C")
        self.ln()
        # Rows
        self.set_font("Arial", "", 9)
        self.set_text_color(40, 40, 40)
        for j, row in enumerate(rows):
            bg = (248, 248, 252) if j % 2 == 0 else (255, 255, 255)
            self.set_fill_color(*bg)
            for i, cell in enumerate(row):
                self.cell(col_widths[i], 7, str(cell)[:40], border=1, fill=True)
            self.ln()
        self.ln(4)


def build_manual():
    pdf = SarahPDF()

    # ── COVER ──
    pdf.cover_page()

    # ── TABLE OF CONTENTS ──
    pdf.add_page()
    pdf.set_font("Arial", "B", 24)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 15, "Indice", new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*TEAL)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(8)
    toc = [
        ("1", "Introduccion a Sarah"),
        ("2", "Arquitectura y Stack Tecnologico"),
        ("3", "Instalacion y Despliegue"),
        ("4", "Configuracion Inicial (Setup Wizard)"),
        ("5", "Chat con Inteligencia Artificial"),
        ("6", "Click2Call y SarahPhone (VoIP WebRTC)"),
        ("7", "Dashboard de Agentes"),
        ("8", "Sistema Multiidioma"),
        ("9", "Integraciones CRM"),
        ("10", "Webhooks"),
        ("11", "Personalizacion del Tema"),
        ("12", "Plugins: WordPress, Shopify, Magento"),
        ("13", "API REST"),
        ("14", "Seguridad"),
        ("15", "Casos de Uso por Equipo"),
        ("16", "Mantenimiento y Operaciones"),
    ]
    for num, title in toc:
        pdf.set_font("Arial", "B", 12)
        pdf.set_text_color(*TEAL)
        pdf.cell(12, 8, num)
        pdf.set_font("Arial", "", 12)
        pdf.set_text_color(*DARK)
        pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")

    # ═══════════════════════════════════════
    # 1. INTRODUCCION
    # ═══════════════════════════════════════
    pdf.chapter_title(1, "Introduccion a Sarah")
    pdf.section("Que es Sarah")
    pdf.body("Sarah es el asistente inteligente de nueva generacion desarrollado por Redegal. Combina inteligencia artificial avanzada, atencion humana en tiempo real, y telefonia VoIP integrada en un unico widget elegante que se embebe en cualquier pagina web.")
    pdf.body("Sarah transforma cada visita en una oportunidad de negocio. Responde al instante con IA entrenada con el conocimiento real de tu empresa, cualifica leads automaticamente, y conecta con agentes humanos cuando es necesario.")

    pdf.section("Caracteristicas Principales")
    pdf.bullet_list([
        "Chat IA multi-proveedor: Claude (Anthropic) + Gemini (Google) + OpenAI con fallback automatico.",
        "4 idiomas: espanol, ingles, portugues y gallego con deteccion automatica.",
        "SarahPhone VoIP: llamadas desde el navegador via WebRTC + Janus Gateway + SIP.",
        "Dashboard profesional para agentes: cola, chat, leads, analytics, settings.",
        "Lead scoring automatico: puntuacion hasta 100 puntos en tiempo real.",
        "CRM: Salesforce, HubSpot, Zoho CRM, Pipedrive con sincronizacion automatica.",
        "Webhooks HMAC SHA-256: 10+ eventos firmados criptograficamente.",
        "Plugins: WordPress, Shopify, Magento 2 listos para instalar.",
        "Rich messages: carruseles, botones, tarjetas interactivas.",
        "Seguridad enterprise: CSRF, CORS, JWT, rate limit, Shadow DOM.",
        "Tema completamente personalizable desde el dashboard.",
        "Notificaciones email con plantillas HTML profesionales.",
    ])

    pdf.section("Lineas de Negocio")
    pdf.body("Sarah esta configurada para las 4 lineas de negocio de Redegal:")
    pdf.table(
        ["Linea", "Descripcion", "Color", "Extension"],
        [
            ["Boostic", "SEO y Growth", "Azul", "107"],
            ["Binnacle", "Business Intelligence", "Purpura", "158"],
            ["Marketing", "Marketing Digital", "Verde", "105"],
            ["Tech", "Desarrollo", "Naranja", "108"],
        ],
        [45, 65, 40, 40]
    )

    # ═══════════════════════════════════════
    # 2. ARQUITECTURA
    # ═══════════════════════════════════════
    pdf.chapter_title(2, "Arquitectura y Stack Tecnologico")
    pdf.section("Componentes del Sistema")
    pdf.body("Sarah se compone de tres pilares fundamentales:")
    pdf.bullet_list([
        "Servidor (server/): Node.js 20 + Express + 3 WebSocket paths (/ws/chat, /ws/agent, /ws/sip).",
        "Widget (widget/): React 19 + TypeScript + Tailwind. Build IIFE en Shadow DOM (227KB JS + 13KB CSS).",
        "Dashboard (dashboard/): React 19 SPA para agentes humanos (245KB JS + 29KB CSS).",
    ])

    pdf.section("Stack Tecnologico")
    pdf.table(
        ["Tecnologia", "Version", "Proposito"],
        [
            ["Node.js", "20 LTS", "Servidor backend"],
            ["Express", "4.x", "Framework HTTP"],
            ["WebSocket (ws)", "8.x", "Comunicacion tiempo real"],
            ["React", "19", "Widget + Dashboard"],
            ["TypeScript", "5.x", "Tipado estatico"],
            ["PostgreSQL", "16", "Base de datos + pgvector"],
            ["Redis", "7", "Cache, sesiones, pub/sub"],
            ["Janus Gateway", "latest", "WebRTC relay para VoIP"],
            ["SIP.js", "0.21", "Cliente SIP en navegador"],
            ["Claude (Anthropic)", "latest", "IA principal"],
            ["Gemini (Google)", "2.5 Flash", "IA gratuita fallback"],
            ["OpenAI", "GPT-4", "IA fallback adicional"],
            ["Docker Compose", "v2", "Orquestacion"],
        ],
        [55, 30, 105]
    )

    pdf.section("Flujo de Datos")
    pdf.body("1. El visitante abre la web. El widget Sarah se carga en un Shadow DOM aislado.")
    pdf.body("2. Escribe un mensaje. Se envia por WebSocket al servidor en tiempo real.")
    pdf.body("3. El servidor consulta la base de conocimiento (pgvector) y genera respuesta con IA.")
    pdf.body("4. Si necesita un humano, la conversacion se escala al dashboard de agentes.")
    pdf.body("5. El agente responde por chat o inicia una llamada VoIP via SarahPhone.")
    pdf.body("6. Al cerrar: encuesta CSAT, lead scoring, CRM dispatch, webhook events.")

    pdf.section("WebSocket Paths")
    pdf.table(
        ["Path", "Proposito", "Usuarios"],
        [
            ["/ws/chat", "Chat visitante <-> bot/agente", "Visitantes web"],
            ["/ws/agent", "Dashboard agentes <-> cola", "Agentes humanos"],
            ["/ws/sip", "Senalizacion WebRTC <-> Janus", "VoIP"],
        ],
        [50, 80, 60]
    )

    # ═══════════════════════════════════════
    # 3. INSTALACION
    # ═══════════════════════════════════════
    pdf.chapter_title(3, "Instalacion y Despliegue")
    pdf.section("Requisitos Previos")
    pdf.bullet_list([
        "Docker y Docker Compose v2 instalados.",
        "Acceso SSH al servidor de destino.",
        "Un dominio o subdominio (ej: chatbot.redegal.com).",
        "Clave API de al menos un proveedor de IA (Gemini es gratuito).",
        "Acceso para editar el HTML/footer de tu web.",
    ])

    pdf.section("Paso 1: Clonar e Instalar")
    pdf.code_block("""git clone https://github.com/jorgevazquez-vagojo/sarah.git
cd sarah
cp .env.example .env
# Editar .env con tus credenciales""")

    pdf.section("Paso 2: Configurar Variables de Entorno")
    pdf.code_block("""# Inteligencia Artificial
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...    # Opcional (premium)

# Telefonia VoIP
SIP_DOMAIN=cloudpbx1584.vozelia.com
SIP_EXTENSION=108
SIP_PASSWORD=xxxxx
CLICK2CALL_EXTENSIONS=107,158,105

# Horario y Branding
TIMEZONE=Europe/Madrid
BUSINESS_HOURS_START=9
BUSINESS_HOURS_END=19
PRIMARY_COLOR=#007fff

# Base de datos
POSTGRES_DB=redegal_chatbot
POSTGRES_USER=redegal
POSTGRES_PASSWORD=tu-password-seguro

# Seguridad
JWT_SECRET=tu-jwt-secret-largo
WIDGET_API_KEY=tu-api-key""")

    pdf.section("Paso 3: Levantar con Docker")
    pdf.code_block("""docker compose up -d

# Servicios desplegados:
# - postgres (pgvector/pg16) en :5432
# - redis (redis:7-alpine) en :6379
# - server (node:20) en :9456
# - janus (janus-gateway) en :8088/:8188""")

    pdf.section("Paso 4: Build del Widget y Dashboard")
    pdf.code_block("""npm install
npm run build
# Genera:
#   widget/dist/widget.js  (227KB)
#   widget/dist/widget.css (13KB)
#   dashboard/dist/         (245KB JS + 29KB CSS)""")

    pdf.section("Paso 5: Integrar en tu Web")
    pdf.code_block("""<!-- Anadir antes de </body> -->
<script>
  window.Sarah = {
    baseUrl: 'https://chatbot.redegal.com/widget',
    configUrl: 'https://chatbot.redegal.com/api/config/widget',
    language: 'auto',
    primaryColor: '#00d4aa',
    theme: {
      branding: {
        companyName: 'Redegal',
        botName: 'Sarah'
      },
      features: {
        enableVoip: true,
        enableLeadForm: true,
        enableLanguageSelector: true
      }
    }
  };
</script>
<script async src="https://chatbot.redegal.com/widget/loader.js"></script>""")

    pdf.info_box("NOTA", "El loader.js crea automaticamente un Shadow DOM aislado. El CSS de Sarah nunca interfiere con tu pagina web.", TEAL)

    pdf.section("Paso 6: Crear Agentes")
    pdf.code_block("""# Crear agente administrador
node scripts/create-agent.js admin admin123 "Admin" "es,en" "boostic,tech"

# Crear agente comercial
node scripts/create-agent.js claudia pass123 "Claudia" "es,gl" "boostic"

# Parametros: usuario, password, nombre, idiomas, lineas de negocio""")

    # ═══════════════════════════════════════
    # 4. SETUP WIZARD
    # ═══════════════════════════════════════
    pdf.chapter_title(4, "Configuracion Inicial")
    pdf.section("Asistente de Configuracion (Setup Wizard)")
    pdf.body("La primera vez que accedes a Sarah en /setup, se muestra un asistente guiado de 5 pasos:")
    pdf.bullet_list([
        "Paso 1 - Datos de Empresa: nombre, logo URL, colores corporativos, direccion.",
        "Paso 2 - Inteligencia Artificial: proveedor (Claude/Gemini/OpenAI), claves API, prompt del sistema.",
        "Paso 3 - Email y Notificaciones: servidor SMTP, puerto, usuario, destinatarios de alertas.",
        "Paso 4 - Lineas de Negocio: nombre, color, extension telefonica para cada BU.",
        "Paso 5 - Revision y Activacion: resumen de toda la configuracion y boton de activar.",
    ])
    pdf.info_box("IMPORTANTE", "El wizard solo se muestra la primera vez. Despues, toda la configuracion se gestiona desde Dashboard > Ajustes.", BLUE)

    # ═══════════════════════════════════════
    # 5. CHAT IA
    # ═══════════════════════════════════════
    pdf.chapter_title(5, "Chat con Inteligencia Artificial")
    pdf.section("Multi-Proveedor con Fallback")
    pdf.body("Sarah utiliza un sistema de IA multi-proveedor con fallback automatico. Si el proveedor principal falla, cambia al siguiente sin que el visitante lo note.")
    pdf.table(
        ["Proveedor", "Modelo", "Coste", "Uso"],
        [
            ["Claude (Anthropic)", "Claude 4.5 Sonnet", "De pago", "Principal (mayor calidad)"],
            ["Gemini (Google)", "2.5 Flash", "Gratuito", "Fallback (20 req/dia free)"],
            ["OpenAI", "GPT-4o", "De pago", "Fallback adicional"],
        ],
        [50, 45, 40, 55]
    )

    pdf.section("Base de Conocimiento")
    pdf.body("Sarah no inventa respuestas. Utiliza una base de conocimiento alimentada con documentos reales de la empresa. La busqueda semantica con pgvector encuentra los fragmentos mas relevantes y los inyecta en el contexto de la IA para generar respuestas precisas.")
    pdf.bullet_list([
        "Formatos soportados: YAML, Markdown, texto plano.",
        "Busqueda semantica con embeddings (pgvector).",
        "Scraper web integrado para importar contenido de paginas.",
        "Contexto inyectado al prompt de IA para precision.",
    ])

    pdf.section("Deteccion de Intencion")
    pdf.body("Sarah detecta automaticamente la intencion del visitante: consulta informativa, queja, solicitud de compra, soporte tecnico. Esto permite personalizar la respuesta y priorizar leads con intencion de compra.")

    pdf.section("Rich Messages")
    pdf.body("Sarah puede enviar mensajes enriquecidos:")
    pdf.bullet_list([
        "Botones: acciones rapidas (Contactar, Ver precios, Llamar).",
        "Carruseles: tarjetas deslizables con imagen, titulo y CTA.",
        "Tarjetas: informacion estructurada de servicios o productos.",
        "Quick replies: respuestas sugeridas para el visitante.",
    ])

    pdf.section("Lead Scoring Automatico")
    pdf.body("Cada interaccion suma puntos al lead score:")
    pdf.table(
        ["Dato", "Puntos", "Detalle"],
        [
            ["Nombre proporcionado", "+10", "El visitante da su nombre"],
            ["Email proporcionado", "+20", "Email de contacto"],
            ["Empresa proporcionada", "+15", "Nombre de empresa"],
            ["Telefono proporcionado", "+15", "Numero de telefono"],
            ["Intencion de compra", "+20", "Detectada por IA"],
            ["Interaccion prolongada", "+10", "Mas de 5 mensajes"],
            ["Solicita agente", "+10", "Pide hablar con humano"],
        ],
        [55, 25, 110]
    )

    # ═══════════════════════════════════════
    # 6. CLICK2CALL Y VOIP
    # ═══════════════════════════════════════
    pdf.chapter_title(6, "Click2Call y SarahPhone (VoIP)")
    pdf.section("Que es SarahPhone")
    pdf.body("SarahPhone es la funcion de telefonia integrada de Sarah. Permite a los visitantes hacer una llamada de voz directamente desde el navegador, sin instalar nada ni descolgar un telefono.")

    pdf.section("Flujo Tecnico")
    pdf.body("1. El visitante hace clic en el boton de llamar del widget.")
    pdf.body("2. El navegador solicita permiso para acceder al microfono.")
    pdf.body("3. SIP.js establece una conexion WebSocket con Janus Gateway.")
    pdf.body("4. Janus traduce WebRTC a SIP y envia INVITE a la centralita Vozelia.")
    pdf.body("5. La centralita hace sonar la extension del agente asignado.")
    pdf.body("6. El agente contesta y se establece audio bidireccional.")

    pdf.section("Configuracion SIP")
    pdf.code_block("""# .env - Configuracion VoIP
SIP_DOMAIN=cloudpbx1584.vozelia.com
SIP_EXTENSION=108
SIP_PASSWORD=tu-password-sip

# Extensiones por linea de negocio
CLICK2CALL_EXTENSIONS=107,158,105

# Janus Gateway
JANUS_URL=http://janus:8088/janus
JANUS_WS_URL=ws://janus:8188
JANUS_PUBLIC_WS=ws://tu-dominio:8188""")

    pdf.section("Extensiones por Linea de Negocio")
    pdf.table(
        ["Linea", "Extension", "Agente", "Descripcion"],
        [
            ["Boostic (SEO)", "107", "Claudia", "Consultas SEO y Growth"],
            ["Binnacle (BI)", "158", "David", "Business Intelligence"],
            ["Marketing", "105", "David (ext)", "Marketing Digital"],
            ["Tech (Dev)", "108", "Click2Call", "Desarrollo y soporte"],
        ],
        [45, 30, 40, 75]
    )

    pdf.section("Funcionalidades Avanzadas")
    pdf.bullet_list([
        "Cola de llamadas: musica de espera cuando el agente esta ocupado.",
        "Grabacion de llamadas: opcional, con transcripcion automatica.",
        "Metricas de calidad: latencia, jitter, perdida de paquetes en tiempo real.",
        "Callback scheduler: el visitante agenda una llamada para mas tarde.",
        "AI Caller: agente de voz con IA para llamadas salientes automaticas.",
        "Fuera de horario: formulario offline (nombre + email obligatorios).",
    ])

    pdf.info_box("HORARIO", "SarahPhone respeta el horario laboral configurado (por defecto 9:00-19:00 Europe/Madrid). Fuera de horario, el boton de llamar se desactiva automaticamente.", GREEN)

    # ═══════════════════════════════════════
    # 7. DASHBOARD
    # ═══════════════════════════════════════
    pdf.chapter_title(7, "Dashboard de Agentes")
    pdf.section("Vision General")
    pdf.body("El dashboard es una aplicacion web profesional (SPA React) donde los agentes gestionan todas las interacciones. Accesible en /dashboard con autenticacion JWT.")

    pdf.section("Secciones del Dashboard")
    pdf.table(
        ["Seccion", "Descripcion"],
        [
            ["Conversaciones", "Cola en tiempo real, filtros, chat con visitante"],
            ["Leads", "Pipeline comercial, scoring, datos de contacto"],
            ["Analytics", "Metricas con graficas Chart.js interactivas"],
            ["Llamadas", "Registro, grabaciones, transcripciones"],
            ["Training", "Revisar respuestas IA, mejorar knowledge base"],
            ["Ajustes", "Tema, respuestas rapidas, webhooks, sistema"],
        ],
        [40, 150]
    )

    pdf.section("Conversaciones")
    pdf.body("La seccion de Conversaciones muestra en tiempo real todas las conversaciones activas con:")
    pdf.bullet_list([
        "Indicadores de prioridad y tiempo de espera.",
        "Idioma detectado y linea de negocio.",
        "Historial completo incluyendo respuestas de la IA.",
        "Respuestas rapidas: /hola, /precios, /demo se expanden automaticamente.",
        "Transferencia entre agentes si cambia la linea de negocio.",
        "Notas internas visibles solo para el equipo.",
    ])

    pdf.section("Respuestas Rapidas (Canned Responses)")
    pdf.body("Los agentes pueden usar atajos de texto que se expanden automaticamente:")
    pdf.code_block("""/hola    -> "Hola, soy [nombre]. En que puedo ayudarte?"
/precios -> "Nuestros planes empiezan en..."
/demo    -> "Puedo programar una demo para ti..."
/bye     -> "Gracias por contactar. Estamos aqui..."

# Configurables desde Dashboard > Ajustes > Respuestas Rapidas""")

    # ═══════════════════════════════════════
    # 8. MULTIIDIOMA
    # ═══════════════════════════════════════
    pdf.chapter_title(8, "Sistema Multiidioma")
    pdf.section("Idiomas Soportados")
    pdf.table(
        ["Codigo", "Idioma", "Deteccion", "Ejemplo"],
        [
            ["es", "Espanol", "Por defecto", "Hola, necesito ayuda"],
            ["en", "Ingles", "Automatica", "Hello, I need help"],
            ["pt", "Portugues", "Automatica", "Ola, preciso de ajuda"],
            ["gl", "Gallego", "Automatica", "Ola, necesito axuda"],
        ],
        [25, 35, 45, 85]
    )

    pdf.section("Como Funciona la Deteccion")
    pdf.body("La deteccion de idioma funciona por analisis de palabras clave en el primer mensaje del visitante. El sistema Language Detector (server/services/language-detector.js) evalua el texto contra diccionarios de keywords de cada idioma y selecciona el de mayor puntuacion.")
    pdf.body("Ademas, el visitante puede cambiar manualmente el idioma en cualquier momento usando el selector del widget (icono de globo).")

    pdf.section("Archivos de Idioma")
    pdf.code_block("""server/config/languages/
  es.yaml  # Espanol
  en.yaml  # Ingles
  pt.yaml  # Portugues
  gl.yaml  # Gallego

# Cada archivo contiene todas las cadenas del sistema:
# bienvenida, despedida, errores, formularios, etc.""")

    # ═══════════════════════════════════════
    # 9. CRM
    # ═══════════════════════════════════════
    pdf.chapter_title(9, "Integraciones CRM")
    pdf.section("CRMs Soportados")
    pdf.body("Sarah se integra con los 4 CRMs mas populares del mercado. La integracion es automatica: cuando se captura un lead o se cierra una conversacion, los datos se envian al CRM configurado.")

    pdf.table(
        ["CRM", "Acciones", "Configuracion"],
        [
            ["Salesforce", "Contactos, oportunidades, actividades", "API Token + Instance URL"],
            ["HubSpot", "Contactos, deals, notes", "API Key (free o premium)"],
            ["Zoho CRM", "Leads, contactos, potenciales", "OAuth + Domain"],
            ["Pipedrive", "Personas, org, deals", "API Token + Domain"],
        ],
        [40, 65, 85]
    )

    pdf.section("Configuracion")
    pdf.code_block("""# Dashboard > Ajustes > CRM
# O directamente en .env:

CRM_PROVIDER=hubspot
HUBSPOT_API_KEY=pat-na1-xxxxx

# Eventos que disparan CRM:
# - lead.created -> Crear contacto
# - conversation.closed -> Actualizar contacto + nota""")

    # ═══════════════════════════════════════
    # 10. WEBHOOKS
    # ═══════════════════════════════════════
    pdf.chapter_title(10, "Webhooks")
    pdf.section("Eventos Disponibles")
    pdf.table(
        ["Evento", "Descripcion"],
        [
            ["conversation.started", "Se inicia nueva conversacion"],
            ["message.new", "Nuevo mensaje (visitante o bot)"],
            ["lead.created", "Se captura un nuevo lead"],
            ["lead.scored", "Se actualiza la puntuacion del lead"],
            ["agent.joined", "Un agente se une a la conversacion"],
            ["agent.left", "Un agente abandona la conversacion"],
            ["call.started", "Se inicia una llamada VoIP"],
            ["call.ended", "Finaliza una llamada VoIP"],
            ["csat.submitted", "Visitante completa encuesta CSAT"],
            ["conversation.closed", "Se cierra la conversacion"],
            ["escalation.requested", "Visitante pide agente humano"],
        ],
        [55, 135]
    )

    pdf.section("Seguridad HMAC")
    pdf.body("Cada webhook se firma con HMAC SHA-256 usando un secreto compartido. El receptor puede verificar la firma para garantizar que el webhook proviene realmente de Sarah.")
    pdf.code_block("""# Header del webhook:
X-Sarah-Signature: sha256=a1b2c3d4...

# Verificacion en el receptor:
const crypto = require('crypto');
const expected = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(body))
  .digest('hex');
const valid = signature === 'sha256=' + expected;""")

    pdf.section("Configuracion")
    pdf.body("Desde Dashboard > Ajustes > Webhooks, configura cada webhook con:")
    pdf.bullet_list([
        "URL destino (HTTPS recomendado).",
        "Secret compartido para firma HMAC.",
        "Eventos a suscribir (seleccion multiple).",
        "Reintentos automaticos con backoff exponencial si el destino falla.",
    ])

    # ═══════════════════════════════════════
    # 11. PERSONALIZACION
    # ═══════════════════════════════════════
    pdf.chapter_title(11, "Personalizacion del Tema")
    pdf.section("Opciones de Personalizacion")
    pdf.body("El tema del widget es completamente configurable desde Dashboard > Ajustes > Tema:")
    pdf.bullet_list([
        "Colores: primario, secundario, gradientes, fondo, texto, acentos.",
        "Tipografia: familia de fuente, tamanos, pesos.",
        "Layout: posicion (bottom-right, bottom-left, top-right, top-left), offset X/Y, tamano.",
        "Branding: nombre empresa, nombre bot, logo URL, mensaje bienvenida, offline, powered by.",
        "Funciones: activar/desactivar VoIP, file upload, emoji, CSAT, lead form, rich messages, sonidos, selector idioma, lineas negocio.",
        "Sonidos: notificacion mensaje, sonido llamada, sonido envio.",
        "Horario: dias laborables, hora inicio/fin, zona horaria.",
    ])

    pdf.section("Ejemplo de Configuracion de Tema")
    pdf.code_block("""window.Sarah = {
  theme: {
    branding: {
      companyName: 'Redegal',
      botName: 'Sarah',
      logoUrl: 'https://redegal.com/logo.svg',
      welcomeMessage: 'Hola! Soy Sarah.',
      offlineMessage: 'Estamos fuera de horario.',
      poweredByText: 'Powered by Redegal AI'
    },
    colors: {
      primary: '#00d4aa',
      secondary: '#6c5ce7',
      gradient: 'linear-gradient(135deg, #00d4aa, #6c5ce7)'
    },
    layout: {
      position: 'bottom-right',
      offsetX: 20, offsetY: 20
    },
    features: {
      enableVoip: true,
      enableFileUpload: true,
      enableCsat: true
    }
  }
};""")

    # ═══════════════════════════════════════
    # 12. PLUGINS
    # ═══════════════════════════════════════
    pdf.chapter_title(12, "Plugins")
    pdf.section("WordPress")
    pdf.body("El plugin de WordPress se instala como cualquier plugin:")
    pdf.bullet_list([
        "Subir plugins/wordpress/rdgbot.php desde el admin de WordPress.",
        "Activar el plugin.",
        "Ir a Ajustes > Sarah y configurar: URL servidor, API key, idioma, color.",
        "Sarah aparece automaticamente en todas las paginas.",
    ])

    pdf.section("Shopify")
    pdf.body("Para Shopify, anadir el snippet Liquid al tema:")
    pdf.bullet_list([
        "Copiar plugins/shopify/rdgbot.liquid al tema activo.",
        "Configurar desde Theme Settings: URL servidor, idioma, color.",
        "El widget se carga automaticamente.",
    ])

    pdf.section("Magento 2")
    pdf.body("Para Magento 2, incluir el template PHTML:")
    pdf.bullet_list([
        "Copiar el template a app/design/frontend/tu-tema/.",
        "Registrar en el layout XML del tema.",
        "Configurar URL y parametros en el template.",
    ])

    pdf.section("HTML Generico")
    pdf.body("Para cualquier otra plataforma, simplemente anadir el codigo de integracion antes de </body> (ver capitulo 3, paso 5).")

    # ═══════════════════════════════════════
    # 13. API REST
    # ═══════════════════════════════════════
    pdf.chapter_title(13, "API REST")
    pdf.section("Endpoints Disponibles")
    pdf.table(
        ["Metodo", "Ruta", "Descripcion"],
        [
            ["GET", "/api/health", "Health check del servidor"],
            ["GET", "/api/config/widget", "Config del widget (tema, idioma)"],
            ["POST", "/api/chat/message", "Enviar mensaje (REST fallback)"],
            ["POST", "/api/leads", "Crear/capturar un lead"],
            ["GET", "/api/leads", "Listar leads (con filtros)"],
            ["GET", "/api/agents", "Listar agentes"],
            ["POST", "/api/agents/login", "Login de agente (JWT)"],
            ["POST", "/api/calls/click2call", "Iniciar llamada Click2Call"],
            ["GET", "/api/analytics/dashboard", "Metricas del dashboard"],
            ["GET/PUT", "/api/settings", "Config del sistema"],
            ["POST", "/api/upload", "Subir archivo (max 10MB)"],
        ],
        [25, 60, 105]
    )

    pdf.section("Autenticacion")
    pdf.body("Todas las rutas protegidas usan autenticacion JWT. Para obtener un token:")
    pdf.code_block("""# Login
POST /api/agents/login
Content-Type: application/json
{ "username": "admin", "password": "admin123" }

# Response
{ "token": "eyJhbG...", "agent": { "id": 1, "name": "Admin" } }

# Usar en requests
Authorization: Bearer eyJhbG...""")

    # ═══════════════════════════════════════
    # 14. SEGURIDAD
    # ═══════════════════════════════════════
    pdf.chapter_title(14, "Seguridad")
    pdf.section("Medidas de Proteccion")
    pdf.table(
        ["Medida", "Descripcion"],
        [
            ["CSRF Protection", "Tokens anti-falsificacion en todas las rutas POST"],
            ["CORS Validado", "Solo origenes autorizados en ALLOWED_ORIGINS"],
            ["JWT Auth", "Tokens firmados HS256 para agentes y APIs"],
            ["Rate Limiting", "Limite por IP para prevenir abusos y fuerza bruta"],
            ["HMAC Webhooks", "Firma SHA-256 en cada webhook disparado"],
            ["Shadow DOM", "Aislamiento total CSS/JS del widget en la pagina host"],
            ["bcrypt", "Contrasenas hasheadas con bcrypt (cost factor 10)"],
            ["Input Validation", "Sanitizacion de entrada en todas las rutas"],
            ["Security Headers", "X-Frame-Options, X-Content-Type, CSP basico"],
        ],
        [50, 140]
    )

    pdf.section("Variables de Seguridad")
    pdf.code_block("""# .env
JWT_SECRET=cadena-larga-y-aleatoria-minimo-32-chars
WIDGET_API_KEY=clave-para-widget
ALLOWED_ORIGINS=https://redegal.com,https://www.redegal.com""")

    # ═══════════════════════════════════════
    # 15. CASOS DE USO
    # ═══════════════════════════════════════
    pdf.chapter_title(15, "Casos de Uso por Equipo")
    pdf.section("Equipo Comercial")
    pdf.bullet_list([
        "Leads cualificados listos cada manana con puntuacion y contexto.",
        "Priorizacion automatica: los leads calientes primero.",
        "Historial completo de conversacion para preparar el contacto.",
        "Click2Call directo desde el dashboard al telefono del visitante.",
        "Metricas de conversion: visita web -> lead -> oportunidad.",
    ])

    pdf.section("Equipo de Soporte")
    pdf.bullet_list([
        "Sarah resuelve consultas frecuentes autonomamente con la KB.",
        "Agentes solo intervienen en consultas complejas.",
        "Respuestas rapidas (/shortcuts) para agilizar el chat.",
        "Transferencia entre agentes por linea de negocio.",
    ])

    pdf.section("Equipo de Marketing")
    pdf.bullet_list([
        "Datos sobre que preguntan los visitantes y que buscan.",
        "Segmentacion por idioma, linea de negocio e interes.",
        "Metricas de engagement: conversaciones, duracion, paginas.",
        "Feedback directo de visitantes via encuestas CSAT.",
    ])

    pdf.section("Direccion")
    pdf.bullet_list([
        "KPIs claros: leads/mes, tasa conversion, CSAT, tiempo respuesta.",
        "ROI medible: coste por lead vs otros canales.",
        "Dashboard de analytics con graficas interactivas.",
        "Informes exportables en CSV/PDF.",
    ])

    # ═══════════════════════════════════════
    # 16. MANTENIMIENTO
    # ═══════════════════════════════════════
    pdf.chapter_title(16, "Mantenimiento y Operaciones")
    pdf.section("Comandos Utiles")
    pdf.code_block("""# Ver logs del servidor
docker compose logs -f server

# Reiniciar servidor
docker compose restart server

# Backup de base de datos
docker compose exec postgres pg_dump -U redegal redegal_chatbot > backup.sql

# Actualizar Sarah
git pull origin main
npm run build
docker compose up --build -d

# Crear nuevo agente
node scripts/create-agent.js usuario pass "Nombre" "es,en" "boostic,tech"

# Seed de knowledge base
node scripts/seed-knowledge.js""")

    pdf.section("Monitorizacion")
    pdf.bullet_list([
        "Health check: GET /api/health retorna status del servidor, DB y Redis.",
        "Logs estructurados con Winston (JSON en produccion).",
        "Metricas de WebSocket: conexiones activas, mensajes/seg.",
        "Dashboard de analytics: metricas de uso en tiempo real.",
    ])

    pdf.section("Actualizaciones")
    pdf.body("Para actualizar Sarah a una nueva version:")
    pdf.code_block("""git pull origin main
npm install
npm run build
docker compose up --build -d
# Zero-downtime si usas un reverse proxy con health checks""")

    # ── SAVE ──
    pdf.output(str(OUTPUT))
    print(f"Manual PDF generado: {OUTPUT}")
    print(f"Tamano: {OUTPUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    build_manual()
