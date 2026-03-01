#!/usr/bin/env python3
"""Generate Sarah presentation video (15 min, ~90 slides) and send via email."""
import os, sys, subprocess, smtplib, math, textwrap
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from PIL import Image, ImageDraw, ImageFont

# --- Config ---
OUT_DIR = "/Users/jorgevazquez/sarah/docs"
SLIDES_DIR = os.path.join(OUT_DIR, "slides")
VIDEO_PATH = os.path.join(OUT_DIR, "Sarah-Presentacion-Completa.mp4")
W, H = 1920, 1080

# Brand
PRIMARY = "#007FFF"
ACCENT = "#00D4AA"
DARK = "#0A0F1A"
DARK2 = "#131A2B"
WHITE = "#FFFFFF"
GRAY = "#8892A4"
LGRAY = "#B8C0D0"
SUCCESS = "#10B981"
WARNING = "#F59E0B"
ERROR = "#FF6B6B"

# Email
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "jorge.vazquez@redegal.com"
SMTP_PASS = "fnhn lruh jsiw xvua"
EMAIL_TO = "jorge.vazquez@redegal.com"

# Fonts
def load_font(size, bold=False):
    paths = [
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except:
            pass
    return ImageFont.load_default()

FONT_TITLE = load_font(64, True)
FONT_H1 = load_font(48, True)
FONT_H2 = load_font(36, True)
FONT_BODY = load_font(28)
FONT_BODY_B = load_font(28, True)
FONT_SMALL = load_font(22)
FONT_CODE = load_font(24)
FONT_BIG = load_font(96, True)
FONT_FOOTER = load_font(18)
FONT_BADGE = load_font(32, True)

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

C_PRIMARY = hex_to_rgb(PRIMARY)
C_ACCENT = hex_to_rgb(ACCENT)
C_DARK = hex_to_rgb(DARK)
C_DARK2 = hex_to_rgb(DARK2)
C_WHITE = hex_to_rgb(WHITE)
C_GRAY = hex_to_rgb(GRAY)
C_LGRAY = hex_to_rgb(LGRAY)
C_SUCCESS = hex_to_rgb(SUCCESS)
C_WARNING = hex_to_rgb(WARNING)
C_ERROR = hex_to_rgb(ERROR)

# --- Drawing helpers ---
def new_slide():
    img = Image.new("RGB", (W, H), C_DARK)
    draw = ImageDraw.Draw(img)
    # Top accent bar
    draw.rectangle([0, 0, W, 3], fill=C_ACCENT)
    return img, draw

def add_footer(draw, num, total):
    y = H - 45
    draw.rectangle([0, y - 5, W, H], fill=hex_to_rgb("#080C16"))
    draw.text((120, y), "Sarah — Redegal", font=FONT_FOOTER, fill=C_GRAY)
    t = f"{num}/{total}"
    bbox = draw.textbbox((0, 0), t, font=FONT_FOOTER)
    draw.text((W - 120 - (bbox[2] - bbox[0]), y), t, font=FONT_FOOTER, fill=C_GRAY)

def draw_bullet(draw, x, y, text, font=FONT_BODY, color=C_LGRAY, bullet_color=C_ACCENT):
    draw.ellipse([x, y + 10, x + 10, y + 20], fill=bullet_color)
    draw.text((x + 24, y), text, font=font, fill=color)
    return y + font.size + 14

def draw_bullets(draw, x, y, items, font=FONT_BODY, color=C_LGRAY, bullet_color=C_ACCENT):
    for item in items:
        # Wrap long lines
        lines = textwrap.wrap(item, width=70)
        for i, line in enumerate(lines):
            if i == 0:
                y = draw_bullet(draw, x, y, line, font, color, bullet_color)
            else:
                draw.text((x + 24, y), line, font=font, fill=color)
                y += font.size + 14
    return y

def draw_heading(draw, y, text, font=FONT_H1, color=C_WHITE):
    draw.text((120, y), text, font=font, fill=color)
    return y + font.size + 20

def draw_section_badge(draw, num, color):
    cx, cy = 120 + 30, 160
    draw.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=hex_to_rgb(color))
    bbox = draw.textbbox((0, 0), str(num), font=FONT_BADGE)
    tw = bbox[2] - bbox[0]
    draw.text((cx - tw // 2, cy - 18), str(num), font=FONT_BADGE, fill=C_WHITE)

def draw_code_block(draw, x, y, lines, w=1680):
    h = len(lines) * 34 + 20
    draw.rectangle([x, y, x + w, y + h], fill=hex_to_rgb("#1A2235"), outline=hex_to_rgb("#2A3555"))
    for i, line in enumerate(lines):
        draw.text((x + 16, y + 10 + i * 34), line, font=FONT_CODE, fill=C_ACCENT)
    return y + h + 16

def draw_card(draw, x, y, w, h, title, items, color=C_PRIMARY):
    draw.rectangle([x, y, x + w, y + h], fill=C_DARK2, outline=hex_to_rgb("#2A3555"))
    draw.rectangle([x, y, x + w, y + 4], fill=hex_to_rgb(color) if isinstance(color, str) else color)
    draw.text((x + 16, y + 14), title, font=FONT_BODY_B, fill=C_WHITE)
    cy = y + 52
    for item in items:
        draw.text((x + 16, cy), item, font=FONT_SMALL, fill=C_LGRAY)
        cy += 28
    return x + w

def draw_progress_bar(draw, x, y, w, pct, color=C_ACCENT):
    draw.rectangle([x, y, x + w, y + 16], fill=hex_to_rgb("#1A2235"))
    draw.rectangle([x, y, x + int(w * pct), y + 16], fill=hex_to_rgb(color) if isinstance(color, str) else color)

def draw_table(draw, x, y, headers, rows, col_widths):
    # Header
    cx = x
    for i, h in enumerate(headers):
        draw.rectangle([cx, y, cx + col_widths[i], y + 44], fill=hex_to_rgb("#1A2B45"))
        draw.text((cx + 10, y + 8), h, font=FONT_BODY_B, fill=C_WHITE)
        cx += col_widths[i]
    y += 44
    for ri, row in enumerate(rows):
        bg = C_DARK2 if ri % 2 == 0 else C_DARK
        cx = x
        for i, cell in enumerate(row):
            draw.rectangle([cx, y, cx + col_widths[i], y + 38], fill=bg)
            draw.text((cx + 10, y + 6), str(cell), font=FONT_SMALL, fill=C_LGRAY)
            cx += col_widths[i]
        y += 38
    return y + 10

def draw_mock_widget(draw, x, y, w=400, h=500):
    """Draw a mock chat widget."""
    # Window
    draw.rectangle([x, y, x + w, y + h], fill=hex_to_rgb("#0F1628"), outline=C_ACCENT)
    # Header
    draw.rectangle([x, y, x + w, y + 50], fill=C_PRIMARY)
    draw.text((x + 16, y + 12), "Sarah", font=FONT_BODY_B, fill=C_WHITE)
    draw.ellipse([x + w - 40, y + 14, x + w - 18, y + 36], fill=C_SUCCESS)
    # Messages
    msgs = [
        (True, "Hola! En que puedo ayudarte?"),
        (False, "Quiero info sobre SEO"),
        (True, "Claro! Nuestro servicio Boostic..."),
    ]
    my = y + 65
    for is_bot, txt in msgs:
        if is_bot:
            bx = x + 12
            bg = hex_to_rgb("#1A2B45")
        else:
            bx = x + w - 280
            bg = C_PRIMARY
        draw.rounded_rectangle([bx, my, bx + 260, my + 44], radius=12, fill=bg)
        draw.text((bx + 12, my + 10), txt[:28], font=FONT_SMALL, fill=C_WHITE)
        my += 56
    # Input
    draw.rectangle([x, y + h - 50, x + w, y + h], fill=hex_to_rgb("#1A2235"))
    draw.text((x + 16, y + h - 38), "Escribe un mensaje...", font=FONT_SMALL, fill=C_GRAY)

# --- SLIDE GENERATORS ---
slides_data = []  # (img, duration_seconds)

def save_slide(img, draw, num, total, duration=10):
    add_footer(draw, num, total)
    path = os.path.join(SLIDES_DIR, f"slide_{num:03d}.png")
    img.save(path, "PNG")
    slides_data.append((path, duration))
    print(f"  Slide {num}/{total} generated")

TOTAL = 93

def gen_all():
    os.makedirs(SLIDES_DIR, exist_ok=True)
    n = 0

    # ===================== SECTION 1: INTRO (6 slides) =====================
    # Slide 1: Title
    n += 1
    img, d = new_slide()
    # Gradient-like background rectangles
    for i in range(20):
        alpha = i * 3
        d.rectangle([0, H//2 - 200 + i*20, W, H//2 - 180 + i*20],
                     fill=(0, int(127*i/20), int(255*i/20)))
    d.rectangle([0, 0, W, H], fill=C_DARK)  # Reset
    # Decorative elements
    for i in range(5):
        d.rectangle([0, 200 + i*140, 8, 260 + i*140], fill=C_ACCENT)
    d.rectangle([W//2 - 500, 280, W//2 + 500, 282], fill=C_PRIMARY)
    # Title
    bbox = d.textbbox((0,0), "Sarah", font=FONT_BIG)
    tw = bbox[2] - bbox[0]
    d.text(((W - tw) // 2, 320), "Sarah", font=FONT_BIG, fill=C_WHITE)
    sub = "Chatbot IA + VoIP para Empresas"
    bbox2 = d.textbbox((0,0), sub, font=FONT_H1)
    tw2 = bbox2[2] - bbox2[0]
    d.text(((W - tw2) // 2, 440), sub, font=FONT_H1, fill=C_ACCENT)
    d.rectangle([W//2 - 500, 520, W//2 + 500, 522], fill=C_PRIMARY)
    d.text(((W - 300) // 2, 560), "by Redegal", font=FONT_H2, fill=C_GRAY)
    d.text(((W - 500) // 2, 640), "Presentacion Completa — 15 minutos", font=FONT_BODY, fill=C_LGRAY)
    save_slide(img, d, n, TOTAL, 8)

    # Slide 2: Que es Sarah
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Que es Sarah?", FONT_H1, C_ACCENT)
    y = draw_bullets(d, 120, 180, [
        "Premium chatbot con IA multi-proveedor",
        "VoIP Click2Call integrado (WebRTC + SIP)",
        "Dashboard de agentes en tiempo real",
        "Widget embebible para cualquier web",
        "Sistema de aprendizaje automatico",
        "Multi-idioma: ES, EN, PT, GL",
    ])
    draw_mock_widget(d, W - 520, 160, 380, 480)
    save_slide(img, d, n, TOTAL)

    # Slide 3: Stack tecnologico
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Stack Tecnologico")
    cards_data = [
        ("Backend", ["Node.js 20", "Express", "WebSocket (ws)", "JWT + bcrypt"], PRIMARY),
        ("Frontend", ["React 19", "TypeScript", "Tailwind CSS", "Shadow DOM"], ACCENT),
        ("Database", ["PostgreSQL 16", "pgvector", "Redis 7", "Full-text search"], SUCCESS),
        ("VoIP", ["Janus WebRTC", "SIP.js", "Vozelia PBX", "Call recording"], WARNING),
    ]
    cx = 120
    for title, items, color in cards_data:
        draw_card(d, cx, 200, 380, 280, title, items, color)
        cx += 410
    save_slide(img, d, n, TOTAL)

    # Slide 4: Arquitectura
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Arquitectura: 3 Workspaces")
    boxes = [
        ("server/", "API REST + WebSocket\nIA Multi-proveedor\nSIP/WebRTC Bridge\nCRM Integrations", C_PRIMARY),
        ("widget/", "IIFE Bundle\nShadow DOM\nChat + VoIP UI\n227KB JS + 13KB CSS", C_ACCENT),
        ("dashboard/", "React SPA\nAgentes + Analytics\nEntrenamiento IA\n245KB JS + 29KB CSS", C_SUCCESS),
    ]
    bx = 120
    for title, desc, color in boxes:
        d.rectangle([bx, 220, bx + 500, 540], fill=C_DARK2, outline=color)
        d.rectangle([bx, 220, bx + 500, 260], fill=color)
        d.text((bx + 20, 228), title, font=FONT_BODY_B, fill=C_WHITE)
        for i, line in enumerate(desc.split("\n")):
            d.text((bx + 20, 280 + i * 36), line, font=FONT_SMALL, fill=C_LGRAY)
        bx += 540
    # Arrow connections
    d.rectangle([620, 530, 1360, 535], fill=C_GRAY)
    d.text((820, 560), "Docker Compose", font=FONT_BODY_B, fill=C_GRAY)
    save_slide(img, d, n, TOTAL)

    # Slide 5: 4 servicios Docker
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "4 Servicios Docker")
    services = [
        ("PostgreSQL 16", ":5432", "Base de datos + pgvector", C_PRIMARY),
        ("Redis 7", ":6379", "Cache + sesiones + pub/sub", C_ERROR),
        ("Server", ":9456", "API + WebSocket + IA", C_ACCENT),
        ("Janus", ":8088", "WebRTC Gateway + SIP", C_WARNING),
    ]
    sy = 200
    for name, port, desc, color in services:
        d.rectangle([120, sy, 1780, sy + 80], fill=C_DARK2, outline=hex_to_rgb("#2A3555"))
        d.rectangle([120, sy, 128, sy + 80], fill=color)
        d.text((160, sy + 8), name, font=FONT_BODY_B, fill=C_WHITE)
        d.text((500, sy + 12), port, font=FONT_CODE, fill=C_ACCENT)
        d.text((700, sy + 12), desc, font=FONT_BODY, fill=C_LGRAY)
        # Status dot
        d.ellipse([1700, sy + 28, 1724, sy + 52], fill=C_SUCCESS)
        sy += 100
    d.text((120, sy + 30), "docker-compose up -d", font=FONT_CODE, fill=C_ACCENT)
    save_slide(img, d, n, TOTAL)

    # Slide 6: Capacidades clave
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Capacidades Clave")
    caps = [
        ("4 Idiomas", "ES, EN, PT, GL con auto-deteccion"),
        ("IA Fallback", "Claude -> Gemini -> GPT-4o-mini"),
        ("CRM Multi", "Salesforce, HubSpot, Zoho, Pipedrive"),
        ("Webhooks", "10 eventos, HMAC-SHA256 firmado"),
        ("Call Recording", "Grabacion + transcripcion IA"),
        ("Learning System", "Auto-mejora con feedback CSAT"),
    ]
    cy = 180
    for title, desc in caps:
        d.rectangle([120, cy, 920, cy + 70], fill=C_DARK2)
        d.rectangle([120, cy, 128, cy + 70], fill=C_ACCENT)
        d.text((148, cy + 6), title, font=FONT_BODY_B, fill=C_WHITE)
        d.text((148, cy + 38), desc, font=FONT_SMALL, fill=C_LGRAY)
        cy += 84
    # Right side decorative
    d.rectangle([1000, 180, 1780, 700], fill=C_DARK2, outline=C_PRIMARY)
    d.text((1020, 200), "Sarah v1.0", font=FONT_H2, fill=C_PRIMARY)
    features = ["Multi-tenant", "Shadow DOM widget", "IIFE embeddable",
                "WebRTC VoIP", "Vector search", "Auto-learning",
                "Proactive triggers", "CSAT surveys", "Wallboard KPI"]
    fy = 260
    for f in features:
        d.ellipse([1040, fy + 6, 1052, fy + 18], fill=C_SUCCESS)
        d.text((1068, fy), f, font=FONT_SMALL, fill=C_LGRAY)
        fy += 34
    save_slide(img, d, n, TOTAL)

    # ===================== SECTION 2: INSTALACION (12 slides) =====================
    # Slide 7: Section title
    n += 1
    img, d = new_slide()
    draw_section_badge(d, 2, PRIMARY)
    d.text((200, 140), "SECCION 2", font=FONT_BODY, fill=C_GRAY)
    bbox = d.textbbox((0,0), "Instalacion", font=FONT_BIG)
    tw = bbox[2] - bbox[0]
    d.text(((W - tw)//2, 350), "Instalacion", font=FONT_BIG, fill=C_PRIMARY)
    d.text(((W - 400)//2, 470), "En Un Solo Comando", font=FONT_H2, fill=C_ACCENT)
    d.rectangle([W//2-300, 540, W//2+300, 542], fill=C_PRIMARY)
    save_slide(img, d, n, TOTAL, 8)

    # Slide 8: Prerrequisitos
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Prerrequisitos")
    reqs = [
        ("Node.js 18+", "Runtime JavaScript del servidor"),
        ("Docker + Docker Compose", "Contenedores para PostgreSQL, Redis, Janus"),
        ("npm", "Gestor de paquetes Node"),
        ("Git", "Control de versiones"),
    ]
    cy = 200
    for title, desc in reqs:
        d.rectangle([120, cy, 1780, cy + 80], fill=C_DARK2)
        d.ellipse([140, cy + 24, 164, cy + 48], fill=C_SUCCESS)
        d.text((184, cy + 10), title, font=FONT_BODY_B, fill=C_WHITE)
        d.text((184, cy + 44), desc, font=FONT_SMALL, fill=C_LGRAY)
        cy += 100
    save_slide(img, d, n, TOTAL)

    # Slide 9: git clone
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Paso 1: Clonar Repositorio")
    draw_code_block(d, 120, 220, [
        "$ git clone https://github.com/redegal/sarah.git",
        "$ cd sarah",
        "",
        "sarah/",
        "  |-- server/        # Backend API + IA + VoIP",
        "  |-- widget/        # Widget embebible",
        "  |-- dashboard/     # Panel de agentes",
        "  |-- docker-compose.yml",
        "  |-- setup.sh       # Instalador interactivo",
    ])
    save_slide(img, d, n, TOTAL)

    # Slide 10: setup.sh
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Paso 2: Setup Interactivo")
    draw_code_block(d, 120, 200, [
        "$ ./setup.sh",
        "",
        "  [Sarah Setup Wizard]",
        "  Empresa: Redegal",
        "  Dominio: redegal.com",
        "  Proveedor IA: Claude (recomendado)",
        "  VoIP: Si",
        "  ...",
        "  Generando secrets automaticamente...",
        "  Setup completado!",
    ])
    save_slide(img, d, n, TOTAL, 12)

    # Slide 11: Auto-generated secrets
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Secrets Auto-Generados")
    y = draw_bullets(d, 120, 200, [
        "JWT_SECRET: token aleatorio de 64 caracteres",
        "DB_PASSWORD: password seguro para PostgreSQL",
        "REDIS_PASSWORD: password para Redis",
        "API_KEY: clave para autenticacion de widget",
        "WEBHOOK_SECRET: para firmar eventos HMAC",
        "SESSION_SECRET: para cookies de dashboard",
    ])
    d.rectangle([120, y + 20, 1780, y + 80], fill=hex_to_rgb("#1A2B45"))
    d.text((140, y + 34), "Todos los secrets se generan con crypto.randomBytes(32) -- nunca hardcoded",
           font=FONT_SMALL, fill=C_WARNING)
    save_slide(img, d, n, TOTAL)

    # Slide 12: Docker Compose
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Paso 3: Docker Compose")
    draw_code_block(d, 120, 200, [
        "$ docker-compose up -d",
        "",
        "Creating sarah-postgres  ... done",
        "Creating sarah-redis     ... done",
        "Creating sarah-janus     ... done",
        "Creating sarah-server    ... done",
        "",
        "4 containers running",
    ])
    save_slide(img, d, n, TOTAL)

    # Slide 13: docker-compose details
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Servicios Docker en Detalle")
    draw_table(d, 120, 200,
        ["Servicio", "Imagen", "Puerto", "Volumen"],
        [
            ["postgres", "postgres:16-alpine", "5432", "sarah_pgdata"],
            ["redis", "redis:7-alpine", "6379", "sarah_redis"],
            ["server", "sarah-server:latest", "9456", "./server"],
            ["janus", "janus-gateway:custom", "8088", "N/A"],
        ],
        [300, 400, 300, 300])
    save_slide(img, d, n, TOTAL)

    # Slide 14: Auto init
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Inicializacion Automatica")
    y = draw_bullets(d, 120, 200, [
        "Schema SQL: 20+ tablas creadas automaticamente",
        "Knowledge Base: YAML cargado en pgvector",
        "Admin user: creado con credenciales del setup",
        "Widget theme: configuracion por defecto aplicada",
        "Business lines: 4 lineas pre-configuradas",
        "Triggers proactivos: 6 reglas por defecto",
    ])
    draw_code_block(d, 120, y + 20, [
        "Tables: users, conversations, messages, leads,",
        "  knowledge_base, learned_responses, call_logs,",
        "  csat_ratings, widget_themes, tenants, ...",
    ])
    save_slide(img, d, n, TOTAL, 12)

    # Slide 15: URLs post-install
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "URLs Post-Instalacion")
    urls = [
        ("Widget Test", "localhost:9456/widget/test.html", "Prueba el chatbot en vivo"),
        ("Dashboard", "localhost:9456/dashboard", "Panel de agentes"),
        ("Health Check", "localhost:9456/health", "Estado del servidor"),
        ("API Docs", "localhost:9456/api/docs", "Documentacion REST"),
    ]
    cy = 200
    for title, url, desc in urls:
        d.rectangle([120, cy, 1780, cy + 90], fill=C_DARK2)
        d.text((160, cy + 10), title, font=FONT_BODY_B, fill=C_WHITE)
        d.text((160, cy + 48), url, font=FONT_CODE, fill=C_ACCENT)
        d.text((900, cy + 28), desc, font=FONT_BODY, fill=C_LGRAY)
        cy += 110
    save_slide(img, d, n, TOTAL)

    # Slide 16: Setup Wizard web
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Setup Wizard Web")
    y = draw_bullets(d, 120, 200, [
        "SMTP: servidor de correo para notificaciones",
        "SIP/PBX: configuracion Vozelia para VoIP",
        "Proveedor IA: Claude, Gemini o GPT + API keys",
        "Horario comercial: timezone + dias/horas",
        "Color corporativo: primary, accent, fonts",
        "Logo: upload del logotipo de la empresa",
    ])
    # Mock wizard UI
    d.rectangle([1100, 180, 1780, 650], fill=C_DARK2, outline=C_PRIMARY)
    d.rectangle([1100, 180, 1780, 220], fill=C_PRIMARY)
    d.text((1120, 188), "Setup Wizard — Paso 3/6", font=FONT_SMALL, fill=C_WHITE)
    d.text((1120, 240), "Proveedor IA", font=FONT_BODY_B, fill=C_WHITE)
    opts = [("Claude Sonnet", True), ("Gemini Flash", False), ("GPT-4o-mini", False)]
    oy = 290
    for opt, sel in opts:
        color = C_ACCENT if sel else C_GRAY
        d.ellipse([1140, oy+2, 1160, oy+22], outline=color, width=2)
        if sel:
            d.ellipse([1145, oy+7, 1155, oy+17], fill=C_ACCENT)
        d.text((1174, oy), opt, font=FONT_SMALL, fill=C_WHITE if sel else C_GRAY)
        oy += 40
    # Button
    d.rounded_rectangle([1120, 560, 1320, 600], radius=8, fill=C_ACCENT)
    d.text((1160, 568), "Siguiente", font=FONT_SMALL, fill=C_DARK)
    save_slide(img, d, n, TOTAL, 12)

    # Slide 17: .env
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Archivo .env: 40+ Variables")
    draw_code_block(d, 120, 200, [
        "# Server",
        "PORT=9456",
        "JWT_SECRET=auto_generated_64char",
        "# Database",
        "DB_HOST=postgres  DB_PORT=5432",
        "DB_NAME=sarah     DB_PASS=auto_gen",
        "# AI Provider",
        "AI_PROVIDER=claude",
        "CLAUDE_API_KEY=sk-ant-...",
        "# VoIP",
        "SIP_SERVER=cloudpbx1584.vozelia.com",
        "SIP_USER=extension  SIP_PASS=***",
        "# SMTP",
        "SMTP_HOST=smtp.gmail.com  SMTP_PORT=587",
    ])
    save_slide(img, d, n, TOTAL)

    # Slide 18: Verificacion
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Verificacion de Instalacion")
    draw_code_block(d, 120, 200, [
        '$ curl localhost:9456/health',
        '',
        '{',
        '  "status": "ok",',
        '  "version": "1.0.0",',
        '  "services": {',
        '    "database": "connected",',
        '    "redis": "connected",',
        '    "janus": "connected",',
        '    "ai": "claude-ready"',
        '  },',
        '  "uptime": "2h 15m"',
        '}',
    ])
    save_slide(img, d, n, TOTAL)

    # ===================== SECTION 3: CONFIGURACION (18 slides) =====================
    n += 1
    img, d = new_slide()
    draw_section_badge(d, 3, PRIMARY)
    d.text((200, 140), "SECCION 3", font=FONT_BODY, fill=C_GRAY)
    bbox = d.textbbox((0,0), "Configuracion", font=FONT_BIG)
    tw = bbox[2] - bbox[0]
    d.text(((W-tw)//2, 350), "Configuracion", font=FONT_BIG, fill=C_PRIMARY)
    d.text(((W-300)//2, 470), "Completa", font=FONT_H2, fill=C_ACCENT)
    d.rectangle([W//2-300, 540, W//2+300, 542], fill=C_PRIMARY)
    save_slide(img, d, n, TOTAL, 8)

    # Slide 20: Panel ajustes
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Panel de Ajustes: 6 Categorias")
    cats = [
        ("Branding", "Logo, colores, tipografia", C_PRIMARY),
        ("Features", "Toggles de funcionalidades", C_ACCENT),
        ("Idiomas", "4 idiomas + auto-detect", C_SUCCESS),
        ("Integraciones", "CRM, SMTP, Webhooks", C_WARNING),
        ("VoIP", "SIP, extensiones, horario", C_ERROR),
        ("Seguridad", "CORS, rate limit, JWT", hex_to_rgb("#9B59B6")),
    ]
    cx, cy = 120, 200
    for i, (title, desc, color) in enumerate(cats):
        x = cx + (i % 3) * 550
        y = cy + (i // 3) * 200
        d.rectangle([x, y, x + 500, y + 160], fill=C_DARK2, outline=hex_to_rgb("#2A3555"))
        d.rectangle([x, y, x + 6, y + 160], fill=color)
        d.text((x + 24, y + 20), title, font=FONT_H2, fill=C_WHITE)
        d.text((x + 24, y + 70), desc, font=FONT_BODY, fill=C_LGRAY)
    save_slide(img, d, n, TOTAL)

    # Slides 21-36: Configuration details
    config_slides = [
        ("Branding Corporativo", [
            "Nombre de empresa visible en el widget",
            "Logo: upload PNG/SVG, se muestra en header",
            "Color primary: accion principal, botones",
            "Color secondary: fondos, badges",
            "Color accent: enlaces, highlights",
            "Favicon personalizado para el dashboard",
        ]),
        ("Tipografia", [
            "Font family: Google Fonts o sistema",
            "Tamano base: mensajes del chat (14-18px)",
            "Tamano header: titulo del widget (16-22px)",
            "Tamano messages: cuerpo de mensajes",
            "Line height y letter spacing ajustables",
            "Preview en tiempo real del cambio",
        ]),
        ("Layout del Widget", [
            "Posicion: bottom-right (default), bottom-left",
            "Offset X/Y: distancia al borde en pixeles",
            "Tamano: compact, normal, large",
            "Border-radius: esquinas redondeadas (0-24px)",
            "Z-index: prioridad sobre otros elementos",
            "Fullscreen en movil: activar/desactivar",
        ]),
        ("Feature Toggles", [
            "VoIP Click2Call: ON/OFF",
            "File upload: imagenes, PDF, docs (10MB max)",
            "Emoji picker: selector de emojis",
            "CSAT survey: encuesta de satisfaccion",
            "Lead form: formulario de prospectos",
            "Quick replies, rich messages, sonido, read receipts",
            "Typing indicator, language selector, dark mode",
            "Business lines selector, proactive triggers",
        ]),
        ("Idiomas: ES, EN, PT, GL", [
            "Auto-deteccion por idioma del navegador",
            "Selector manual con banderas",
            "Todas las cadenas traducidas (200+ strings)",
            "Knowledge base separado por idioma",
            "Respuestas predefinidas multi-idioma",
            "Dashboard del agente tambien traducible",
        ]),
        ("4 Lineas de Negocio", [
            "Boostic (SEO/SEM) — Icono: cohete, Color: #007FFF",
            "Binnacle (BI/Analytics) — Icono: grafico, Color: #10B981",
            "Marketing Digital — Icono: megafono, Color: #F59E0B",
            "Digital Tech — Icono: codigo, Color: #9B59B6",
            "Cada linea tiene routing y agentes dedicados",
            "El visitante elige la linea en el welcome screen",
        ]),
        ("Horario Comercial", [
            "Timezone: Europe/Madrid (configurable)",
            "Lunes a Viernes: 09:00 - 19:00",
            "Sabados: configurable (OFF por defecto)",
            "Domingos y festivos: cerrado",
            "Fuera de horario: formulario offline",
            "Mensaje personalizable fuera de horario",
        ]),
        ("Proveedor IA: Triple Fallback", [
            "Primary: Claude Sonnet 4 (Anthropic)",
            "Fallback 1: Gemini 2.5 Flash (Google, gratis)",
            "Fallback 2: GPT-4o-mini (OpenAI)",
            "Si primary falla -> intenta fallback1 -> fallback2",
            "Cada proveedor con su API key independiente",
            "Metricas de uso y coste por proveedor",
        ]),
        ("Knowledge Base (6 YAML)", [
            "general.yml: info empresa, horario, contacto",
            "boostic.yml: servicios SEO, SEM, casos exito",
            "binnacle.yml: BI, dashboards, reportes",
            "marketing.yml: campanas, social media, email",
            "tech.yml: desarrollo, cloud, DevOps",
            "casos-exito.yml: Lacoste, ABANCA, Oney...",
        ]),
        ("SMTP: Notificaciones Email", [
            "Servidor: smtp.gmail.com (o cualquier SMTP)",
            "Puerto: 587 (TLS) o 465 (SSL)",
            "Usuario y password de aplicacion",
            "Boton 'Test SMTP' para verificar",
            "Templates HTML premium para emails",
            "3 tipos: escalacion, callback, resumen",
        ]),
        ("SIP/PBX: Configuracion VoIP", [
            "Servidor SIP: cloudpbx1584.vozelia.com",
            "Extension y password del agente",
            "Codec: opus (preferido), G.711",
            "SRTP para encriptacion de media",
            "Caller ID personalizable",
            "Extension diferente por linea de negocio",
        ]),
        ("CRM: 4 Adaptadores", [
            "Salesforce: OAuth2, crea Lead + Opportunity",
            "HubSpot: API key, crea Contact + Deal",
            "Zoho: OAuth2, crea Lead + Potential",
            "Pipedrive: API token, crea Person + Deal",
            "Adaptador generico: cualquier CRM via API REST",
            "Sync bidireccional: webhook de vuelta al CRM",
        ]),
        ("Webhooks: 10 Eventos", [
            "conversation.started — nueva conversacion",
            "conversation.ended — conversacion cerrada",
            "message.received — mensaje del visitante",
            "lead.created — nuevo prospecto capturado",
            "lead.scored — score actualizado",
            "call.started / call.ended — llamadas VoIP",
            "csat.submitted — encuesta completada",
            "agent.assigned — agente tomo conversacion",
            "Todos firmados con HMAC-SHA256",
        ]),
        ("Respuestas Predefinidas", [
            "/saludo -> Hola! En que puedo ayudarte?",
            "/precio -> Solicita presupuesto en redegal.com/contacto",
            "/horario -> L-V 09:00-19:00 (Europe/Madrid)",
            "/transfer -> Te paso con un agente humano",
            "Multi-idioma: /greeting, /preco, /saudo",
            "Gestionables desde Dashboard > Ajustes",
        ]),
        ("Triggers Proactivos: 6 Tipos", [
            "Tiempo en pagina: 30 seg -> mensaje proactivo",
            "Pagina de precios: oferta especial",
            "Exit intent: detecta cursor saliendo",
            "Return visitor: bienvenida personalizada",
            "Cart abandon: recordatorio de compra (e-commerce)",
            "Idle form: formulario sin completar 60 seg",
        ]),
        ("Seguridad Bank-Grade", [
            "CORS: whitelist de dominios permitidos",
            "CSRF: token por sesion para dashboard",
            "XSS: sanitizacion DOMPurify en todos los inputs",
            "Rate limiting: 100 req/min por IP",
            "JWT: tokens firmados con rotacion",
            "bcrypt: hash de passwords con salt",
            "SSRF protection: validacion de URLs en webhooks",
        ]),
    ]
    for title, items in config_slides:
        n += 1
        img, d = new_slide()
        draw_heading(d, 80, title)
        draw_bullets(d, 120, 200, items)
        save_slide(img, d, n, TOTAL)

    # ===================== SECTION 4: CHATBOT UX (18 slides) =====================
    n += 1
    img, d = new_slide()
    draw_section_badge(d, 4, ACCENT)
    d.text((200, 140), "SECCION 4", font=FONT_BODY, fill=C_GRAY)
    t = "El Chatbot"
    bbox = d.textbbox((0,0), t, font=FONT_BIG)
    d.text(((W-bbox[2]+bbox[0])//2, 350), t, font=FONT_BIG, fill=C_ACCENT)
    d.text(((W-500)//2, 470), "Experiencia del Visitante", font=FONT_H2, fill=C_WHITE)
    d.rectangle([W//2-300, 540, W//2+300, 542], fill=C_ACCENT)
    save_slide(img, d, n, TOTAL, 8)

    chatbot_slides = [
        ("Widget Flotante", [
            "Boton circular esquina inferior derecha",
            "Animacion de pulso al cargar la pagina",
            "Badge con numero de mensajes sin leer",
            "Click para abrir el panel de chat",
            "Personalizable: posicion, color, tamano",
            "Shadow DOM: aislado del CSS de la web host",
        ]),
        ("Welcome View", [
            "Saludo personalizado: Hola! Soy Sarah",
            "Selector de linea de negocio (4 cards)",
            "Cards con gradientes y iconos por BU",
            "Boostic | Binnacle | Marketing | Tech",
            "Click en card -> abre chat con contexto de esa BU",
            "Opcion directa: Hablar con un agente",
        ]),
        ("Selector de Idioma", [
            "Banderas: ES, EN, PT, GL",
            "Auto-detecta el idioma del navegador",
            "Cambio en caliente sin recargar",
            "200+ strings traducidos a 4 idiomas",
            "Knowledge base cambia segun idioma",
            "Respuestas del bot en el idioma elegido",
        ]),
        ("Chat View: Mensajes", [
            "Burbujas de mensaje: bot (izquierda) y usuario (derecha)",
            "Timestamps con formato relativo (hace 2 min)",
            "Avatar del bot con logo de Sarah",
            "Colores diferentes bot vs usuario",
            "Scroll automatico al ultimo mensaje",
            "Animacion suave al recibir mensajes",
        ]),
        ("IA Contextual", [
            "Knowledge base inyectado automaticamente",
            "Respuestas basadas en los 6 YAML",
            "Contexto de la linea de negocio seleccionada",
            "Historial de conversacion como contexto",
            "Deteccion de intencion del usuario",
            "Escalacion automatica si confianza < 70%",
        ]),
        ("Quick Replies", [
            "Botones predefinidos bajo cada mensaje",
            "Si / No / Mas info / Contactar / Precios",
            "Configurables por linea de negocio",
            "Click -> envia como mensaje del usuario",
            "Estilo: pill buttons con color accent",
            "Desaparecen tras seleccionar uno",
        ]),
        ("Rich Messages: Cards", [
            "Cards con imagen, titulo, descripcion",
            "Botones de accion: Ver mas, Contratar, Llamar",
            "Ideal para mostrar servicios y productos",
            "Layout responsive dentro del widget",
            "Imagen con lazy loading",
            "Multiples botones por card",
        ]),
        ("Carruseles", [
            "Multiples cards deslizables horizontalmente",
            "Flechas de navegacion izquierda/derecha",
            "Indicadores de pagina (dots)",
            "Touch/swipe en movil",
            "Ideal para: servicios, portfolio, precios",
            "Cada card es interactiva (botones, links)",
        ]),
        ("Subida de Archivos", [
            "Drag & drop o click para seleccionar",
            "Tipos: imagenes, PDF, docs (hasta 10MB)",
            "Preview inline de imagenes",
            "Icono de archivo para PDFs/docs",
            "Barra de progreso durante upload",
            "El agente ve los archivos en el dashboard",
        ]),
        ("Indicadores de Estado", [
            "Typing dots: el bot esta escribiendo...",
            "Read receipts: doble check azul",
            "Hora de envio en cada mensaje",
            "Estado de conexion: online/offline",
            "Reconexion automatica WebSocket",
            "Indicador de calidad de conexion",
        ]),
        ("Dark Mode", [
            "Toggle en el header del widget",
            "Tema oscuro completo: fondo, texto, burbujas",
            "Respeta preferencia del sistema (prefers-color-scheme)",
            "Persistente en localStorage",
            "Transicion suave entre temas",
            "Todos los elementos adaptados (inputs, botones, cards)",
        ]),
        ("Formulario Offline", [
            "Se muestra fuera de horario comercial",
            "Campos: nombre, email, mensaje",
            "Se envia por email al equipo",
            "Confirmacion visual al enviar",
            "Se registra como lead en el sistema",
            "Respuesta automatica al visitante",
        ]),
        ("Lead Form + Scoring", [
            "Formulario: nombre, email, telefono, empresa",
            "Scoring automatico 0-100 basado en:",
            "  - Paginas visitadas (engagement)",
            "  - Tiempo en sitio",
            "  - Linea de negocio de interes",
            "  - Informacion de empresa proporcionada",
            "Lead aparece en Dashboard > Leads con score",
        ]),
        ("CSAT: Encuesta de Satisfaccion", [
            "Se muestra al cerrar la conversacion",
            "5 estrellas + campo de comentario opcional",
            "Almacenado en base de datos",
            "Webhook csat.submitted disparado",
            "Metricas agregadas en Dashboard > Analytics",
            "CSAT >= 4 estrellas: respuesta marcada como buena",
        ]),
        ("Triggers Proactivos", [
            "Veo que llevas 30 seg en la web, te ayudo?",
            "Estas en la pagina de precios? Tengo una oferta",
            "Detectamos que vas a salir, necesitas algo?",
            "Bienvenido de vuelta! Seguimos donde lo dejamos?",
            "Tu carrito tiene items sin comprar",
            "Llevas 60 seg sin completar el formulario",
        ]),
        ("Escalacion a Agente Humano", [
            "Visitante: Quiero hablar con una persona",
            "Bot transfiere a la cola de agentes",
            "Notificacion push al dashboard",
            "Email al equipo si ningun agente online",
            "Agente ve historial completo de la conversacion",
            "Transicion transparente para el visitante",
        ]),
    ]
    for title, items in chatbot_slides:
        n += 1
        img, d = new_slide()
        draw_heading(d, 80, title)
        draw_bullets(d, 120, 200, items)
        # Add mock widget on some slides
        if "Widget" in title or "Chat View" in title or "Welcome" in title:
            draw_mock_widget(d, W - 480, 140, 360, 480)
        save_slide(img, d, n, TOTAL)

    # ===================== SECTION 5: CLICK2CALL (12 slides) =====================
    n += 1
    img, d = new_slide()
    draw_section_badge(d, 5, WARNING)
    d.text((200, 140), "SECCION 5", font=FONT_BODY, fill=C_GRAY)
    t = "SarahPhone"
    bbox = d.textbbox((0,0), t, font=FONT_BIG)
    d.text(((W-bbox[2]+bbox[0])//2, 350), t, font=FONT_BIG, fill=hex_to_rgb(WARNING))
    d.text(((W-400)//2, 470), "VoIP Click2Call", font=FONT_H2, fill=C_WHITE)
    d.rectangle([W//2-300, 540, W//2+300, 542], fill=hex_to_rgb(WARNING))
    save_slide(img, d, n, TOTAL, 8)

    voip_slides = [
        ("Como Funciona Click2Call", [
            "1. Visitante pulsa boton Llamar en el widget",
            "2. Navegador abre WebRTC via SIP.js",
            "3. Janus Gateway recibe la sesion WebRTC",
            "4. Janus convierte a SIP y envia a Vozelia PBX",
            "5. PBX enruta a la extension del agente",
            "6. Agente contesta -> audio bidireccional",
        ]),
        ("Call View en Widget", [
            "Interfaz de llamada integrada en el widget",
            "Boton de microfono (mute/unmute)",
            "Boton de colgar (rojo)",
            "Indicador de duracion de llamada",
            "Indicador de calidad de audio",
            "Estado: conectando... / en llamada / finalizada",
        ]),
        ("Janus WebRTC Gateway", [
            "Media server open-source",
            "Plugin SIP: conecta WebRTC con SIP trunk",
            "Plugin AudioBridge: para conferencias",
            "SRTP: encriptacion de media",
            "ICE/STUN/TURN para NAT traversal",
            "API REST + WebSocket para control",
        ]),
        ("Audio Quality Monitoring", [
            "Jitter: variacion en latencia de paquetes",
            "Packet loss: porcentaje de paquetes perdidos",
            "RTCPeerConnection stats en tiempo real",
            "Alertas si calidad baja de umbral",
            "Metricas guardadas por llamada",
            "Dashboard muestra calidad promedio",
        ]),
        ("Flujo SIP Completo", [
            "INVITE -> 100 Trying -> 180 Ringing",
            "-> 200 OK -> ACK",
            "-> RTP media bidireccional",
            "-> BYE -> 200 OK",
            "Codec negociado: Opus (48kHz) preferido",
            "Fallback: G.711 u-law / a-law",
        ]),
        ("Click2Call: Vista del Agente", [
            "Agente recibe llamada en su extension Vozelia",
            "Caller ID muestra: Lead Web - [nombre]",
            "Softphone o telefono fisico",
            "Historial de chat visible durante la llamada",
            "Notas del agente en tiempo real",
            "Grabacion automatica activada",
        ]),
        ("Grabacion de Llamadas", [
            "Grabacion automatica de todas las llamadas",
            "Formato: WAV o MP3 (configurable)",
            "Retencion: 30 dias por defecto (ajustable)",
            "Reproducible desde Dashboard > Llamadas",
            "Descargable por supervisores/admins",
            "Almacenamiento: disco local o S3",
        ]),
        ("Transcripcion IA", [
            "OpenAI Whisper (primary) para speech-to-text",
            "Gemini (fallback) si Whisper no disponible",
            "Transcripcion completa searchable en dashboard",
            "Deteccion de sentimiento en la llamada",
            "Keywords extraidos automaticamente",
            "Util para QA y training de agentes",
        ]),
        ("Callback Scheduling", [
            "Visitante agenda hora preferida para llamada",
            "Selector de fecha y hora en el widget",
            "Recordatorio automatico al agente 15 min antes",
            "Email de confirmacion al visitante",
            "Registro en Dashboard > Llamadas > Programadas",
            "Reagendable por el agente si necesario",
        ]),
        ("Extensiones por Linea de Negocio", [
            "Boostic: extension 1001",
            "Binnacle: extension 1002",
            "Marketing: extension 1003",
            "Tech: extension 1004",
            "Routing automatico segun BU seleccionada",
            "Fallback a extension general si no contestan",
        ]),
    ]
    for title, items in voip_slides:
        n += 1
        img, d = new_slide()
        draw_heading(d, 80, title)
        draw_bullets(d, 120, 200, items)
        save_slide(img, d, n, TOTAL)

    # Slide: fuera de horario
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Fuera de Horario")
    y = draw_bullets(d, 120, 200, [
        "Boton de llamada se oculta automaticamente",
        "Se muestra formulario offline en su lugar",
        "Mensaje: Estamos fuera de horario, dejanos tu mensaje",
        "Callback scheduling disponible 24/7",
        "Email automatico al equipo con los datos",
        "Lead registrado para seguimiento al dia siguiente",
    ])
    save_slide(img, d, n, TOTAL)

    # ===================== SECTION 6: DASHBOARD (18 slides) =====================
    n += 1
    img, d = new_slide()
    draw_section_badge(d, 6, SUCCESS)
    d.text((200, 140), "SECCION 6", font=FONT_BODY, fill=C_GRAY)
    t = "Dashboard"
    bbox = d.textbbox((0,0), t, font=FONT_BIG)
    d.text(((W-bbox[2]+bbox[0])//2, 350), t, font=FONT_BIG, fill=C_SUCCESS)
    d.text(((W-500)//2, 470), "Centro de Operaciones", font=FONT_H2, fill=C_WHITE)
    d.rectangle([W//2-300, 540, W//2+300, 542], fill=C_SUCCESS)
    save_slide(img, d, n, TOTAL, 8)

    dash_slides = [
        ("Login y Roles", [
            "Usuario + contrasena con hash bcrypt",
            "JWT token con expiracion configurable",
            "3 roles: Admin, Supervisor, Agent",
            "Admin: acceso total, configuracion, usuarios",
            "Supervisor: analytics, entrenamiento, llamadas",
            "Agent: conversaciones, leads asignados",
        ]),
        ("Vista Principal", [
            "Sidebar de navegacion a la izquierda",
            "Tabs: Conversaciones, Leads, Analytics, Llamadas",
            "Tab Entrenamiento (Supervisor+)",
            "Tab Ajustes (Admin)",
            "Indicador de status del agente en header",
            "Notificaciones en tiempo real via WebSocket",
        ]),
        ("Tab Conversaciones (Queue)", [
            "Lista de conversaciones en tiempo real",
            "Tiempo de espera por conversacion",
            "Mensajes sin leer con badge numerico",
            "Click para abrir el panel de conversacion",
            "Filtros: activas, en espera, cerradas",
            "Busqueda por nombre, email, contenido",
        ]),
        ("Panel de Conversacion", [
            "Historial completo de mensajes",
            "Input de respuesta con rich text",
            "Notas internas del agente (no visibles al visitante)",
            "Info del visitante: nombre, email, paginas visitadas",
            "Score del lead en sidebar derecha",
            "Boton: cerrar conversacion + trigger CSAT",
        ]),
        ("Tomar Conversacion", [
            "Agente pulsa Tomar para asignarse el chat",
            "Visitante ve: Agente [nombre] conectado",
            "Historial del bot permanece visible",
            "Agente puede devolver al bot si necesario",
            "Tiempo de respuesta del agente medido",
            "SLA configurable por prioridad",
        ]),
        ("Respuestas Predefinidas", [
            "Escribir /saludo -> Hola! En que puedo ayudarte?",
            "Escribir /precio -> Info de precios expandida",
            "Escribir /horario -> Horario de atencion",
            "Autocompletado al escribir /",
            "Gestionables desde Ajustes > Respuestas",
            "Multi-idioma: se expanden en el idioma del chat",
        ]),
        ("Tab Leads: Pipeline", [
            "Pipeline visual de prospectos",
            "Score 0-100 con barra de color",
            "Status: New -> Contacted -> Qualified -> Converted",
            "Drag & drop entre columnas (Kanban)",
            "Detalle: historial de conversaciones, llamadas",
            "Export CSV para CRM externo",
        ]),
        ("Tab Analytics", [
            "Metricas diarias, semanales, mensuales",
            "Tasa de resolucion por IA vs agente",
            "CSAT promedio (1-5 estrellas)",
            "Tiempo medio de primera respuesta",
            "Tasa de conversion: visitante -> lead -> cliente",
            "Comparativa periodo anterior",
        ]),
        ("Graficos y Visualizaciones", [
            "Barras por hora: distribucion de conversaciones",
            "Lineas de tendencia: volumen semanal",
            "Distribucion CSAT: pie chart 1-5 estrellas",
            "Heatmap: horas pico de actividad",
            "Top queries: preguntas mas frecuentes",
            "Rendimiento por agente (tabla ranking)",
        ]),
        ("Tab Llamadas", [
            "Historial de todas las llamadas VoIP",
            "Duracion, fecha, agente, extension",
            "Grabaciones reproducibles inline",
            "Transcripciones completas expandibles",
            "Filtros: fecha, agente, duracion, BU",
            "Metricas: llamadas/dia, duracion media, % contestadas",
        ]),
        ("Tab Entrenamiento", [
            "Revisar respuestas del bot una por una",
            "Marcar como: Buena / Mala / Corregida",
            "Si corregida: escribir respuesta correcta",
            "Auto-learning: CSAT >= 4 -> marca como buena",
            "Respuesta guardada como embedding vectorial",
            "Proxima pregunta similar -> usa respuesta corregida",
        ]),
        ("Sistema de Aprendizaje", [
            "pgvector: embeddings de preguntas + respuestas",
            "Busqueda por similitud coseno",
            "Threshold configurable (default 0.85)",
            "Respuestas aprendidas tienen prioridad",
            "Feedback loop: correccion -> embedding -> uso futuro",
            "Metricas: % respuestas del knowledge vs aprendidas",
        ]),
        ("Wallboard: Pantalla KPI", [
            "Diseñado para pantallas de call center",
            "Actualizacion en tiempo real cada 5 segundos",
            "Metricas grandes y visibles a distancia",
            "Fondo oscuro optimizado para pantallas",
            "Full-screen mode (F11)",
            "Sin interaccion necesaria: solo visualizar",
        ]),
        ("Wallboard: Metricas", [
            "Llamadas activas ahora",
            "Chats activos ahora",
            "Conversaciones en cola",
            "Agentes online / total",
            "SLA% (respondidas en < X segundos)",
            "CSAT promedio del dia",
        ]),
        ("Wallboard por Linea de Negocio", [
            "Profundidad de cola por BU",
            "Agentes asignados por BU",
            "Tiempo de espera medio por BU",
            "SLA% por linea de negocio",
            "Color coding: verde (OK), amarillo (atencion), rojo (critico)",
            "Alertas visuales si SLA < 80%",
        ]),
        ("Status de Agente", [
            "Online: disponible para tomar conversaciones",
            "Busy: en conversacion/llamada activa",
            "Away: ausente temporalmente",
            "Offline: desconectado",
            "Cambio en tiempo real via WebSocket",
            "Auto-away despues de X minutos de inactividad",
        ]),
    ]
    for title, items in dash_slides:
        n += 1
        img, d = new_slide()
        draw_heading(d, 80, title)
        draw_bullets(d, 120, 200, items)
        save_slide(img, d, n, TOTAL)

    # ===================== SECTION 7: INTEGRACIONES (6 slides) =====================
    n += 1
    img, d = new_slide()
    draw_section_badge(d, 7, ERROR)
    d.text((200, 140), "SECCION 7", font=FONT_BODY, fill=C_GRAY)
    t = "Integraciones"
    bbox = d.textbbox((0,0), t, font=FONT_BIG)
    d.text(((W-bbox[2]+bbox[0])//2, 350), t, font=FONT_BIG, fill=hex_to_rgb(ERROR))
    d.text(((W-300)//2, 470), "y Plugins", font=FONT_H2, fill=C_WHITE)
    d.rectangle([W//2-300, 540, W//2+300, 542], fill=hex_to_rgb(ERROR))
    save_slide(img, d, n, TOTAL, 8)

    int_slides = [
        ("CRM: 4 Adaptadores Nativos", [
            "Salesforce: OAuth2, Lead + Opportunity sync",
            "HubSpot: API key, Contact + Deal creation",
            "Zoho: OAuth2, Lead + Potential management",
            "Pipedrive: API token, Person + Deal pipeline",
            "Generic REST: cualquier CRM via configuracion",
            "Sync bidireccional con webhooks de vuelta",
        ]),
        ("Webhooks: Eventos en Tiempo Real", [
            "10 tipos de evento disponibles",
            "Firma HMAC-SHA256 en cada payload",
            "Retry exponencial: 5 intentos",
            "Proteccion SSRF en URLs de destino",
            "Logs de delivery en dashboard",
            "Configurable por evento: activar/desactivar",
        ]),
        ("Email: Notificaciones Premium", [
            "Escalacion: cuando el bot transfiere a agente",
            "Solicitud de llamada: callback request del visitante",
            "Resumen: conversacion completa al cerrar",
            "Templates HTML responsive y profesionales",
            "Personalizables con branding de la empresa",
            "SMTP configurable: cualquier proveedor",
        ]),
        ("Plugin WordPress", [
            "rdgbot.php: plugin oficial para WordPress",
            "Settings page en wp-admin > Sarah",
            "Campos: API key, dominio del servidor Sarah",
            "Toggle ON/OFF global",
            "Auto-embed del widget en el footer",
            "Compatible con temas y page builders",
        ]),
        ("Plugins Shopify + Magento 2", [
            "Shopify: snippet liquid para theme.liquid",
            "Magento 2: modulo PHTML con layout XML",
            "Configuracion por tema/tienda",
            "Mismo widget, diferentes plataformas",
            "Instrucciones de instalacion paso a paso",
            "Soporte para multi-tienda",
        ]),
    ]
    for title, items in int_slides:
        n += 1
        img, d = new_slide()
        draw_heading(d, 80, title)
        draw_bullets(d, 120, 200, items)
        save_slide(img, d, n, TOTAL)

    # ===================== SECTION 8: CIERRE (3 slides) =====================
    # Slide: Resumen
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "Resumen: Todo en Docker", FONT_H1, C_ACCENT)
    components = [
        ("Chatbot IA", "Multi-proveedor con learning", C_PRIMARY),
        ("VoIP Click2Call", "WebRTC + SIP + grabacion", hex_to_rgb(WARNING)),
        ("Dashboard", "Agentes + analytics + training", C_SUCCESS),
        ("Integraciones", "CRM + webhooks + plugins", hex_to_rgb(ERROR)),
    ]
    cy = 200
    for title, desc, color in components:
        d.rectangle([120, cy, 900, cy + 80], fill=C_DARK2)
        d.rectangle([120, cy, 130, cy + 80], fill=color)
        d.text((160, cy + 8), title, font=FONT_BODY_B, fill=C_WHITE)
        d.text((160, cy + 44), desc, font=FONT_SMALL, fill=C_LGRAY)
        cy += 100
    d.rectangle([1000, 200, 1780, 640], fill=C_DARK2, outline=C_ACCENT)
    d.text((1020, 220), "Un solo comando:", font=FONT_BODY_B, fill=C_WHITE)
    d.text((1020, 270), "docker-compose up -d", font=FONT_H2, fill=C_ACCENT)
    d.text((1020, 340), "4 containers", font=FONT_BODY, fill=C_LGRAY)
    d.text((1020, 380), "20+ tablas auto-migradas", font=FONT_BODY, fill=C_LGRAY)
    d.text((1020, 420), "Setup wizard incluido", font=FONT_BODY, fill=C_LGRAY)
    d.text((1020, 460), "Knowledge base pre-cargado", font=FONT_BODY, fill=C_LGRAY)
    d.text((1020, 500), "Produccion-ready", font=FONT_BODY, fill=C_LGRAY)
    save_slide(img, d, n, TOTAL)

    # Slide: ROI
    n += 1
    img, d = new_slide()
    draw_heading(d, 80, "ROI: Impacto Medible", FONT_H1, C_SUCCESS)
    metrics = [
        ("-60%", "Tiempo de respuesta", "De minutos a segundos con IA"),
        ("+40%", "Leads capturados", "Formularios + scoring automatico"),
        ("24/7", "Atencion continua", "Bot siempre activo, offline form fuera horario"),
        ("4", "Idiomas simultaneos", "ES, EN, PT, GL sin coste adicional"),
        ("100%", "Conversaciones grabadas", "Historial completo + transcripcion"),
    ]
    cy = 200
    for value, title, desc in metrics:
        d.rectangle([120, cy, 1780, cy + 90], fill=C_DARK2)
        color = C_SUCCESS if value.startswith("+") or value.startswith("2") or value.startswith("1") or value == "4" else C_ACCENT
        d.text((160, cy + 10), value, font=FONT_H1, fill=color)
        d.text((420, cy + 8), title, font=FONT_BODY_B, fill=C_WHITE)
        d.text((420, cy + 46), desc, font=FONT_SMALL, fill=C_LGRAY)
        cy += 110
    save_slide(img, d, n, TOTAL, 12)

    # Slide: Contacto final
    n += 1
    img, d = new_slide()
    # Decorative bars
    d.rectangle([0, 0, W, 4], fill=C_ACCENT)
    d.rectangle([0, H-4, W, H], fill=C_PRIMARY)
    for i in range(5):
        d.rectangle([0, 200 + i*140, 8, 260 + i*140], fill=C_ACCENT)
    t = "Sarah"
    bbox = d.textbbox((0,0), t, font=FONT_BIG)
    d.text(((W-bbox[2]+bbox[0])//2, 250), t, font=FONT_BIG, fill=C_WHITE)
    sub = "Chatbot IA Premium"
    bbox2 = d.textbbox((0,0), sub, font=FONT_H1)
    d.text(((W-bbox2[2]+bbox2[0])//2, 370), sub, font=FONT_H1, fill=C_ACCENT)
    d.rectangle([W//2-300, 440, W//2+300, 442], fill=C_PRIMARY)
    d.text(((W-500)//2, 480), "jorge.vazquez@redegal.com", font=FONT_H2, fill=C_LGRAY)
    d.text(((W-200)//2, 540), "redegal.com", font=FONT_H2, fill=C_PRIMARY)
    d.text(((W-400)//2, 620), "by Redegal — 2026", font=FONT_BODY, fill=C_GRAY)
    # No footer on last slide
    d.rectangle([0, H-45, W, H], fill=C_DARK)
    d.rectangle([0, H-4, W, H], fill=C_PRIMARY)
    path = os.path.join(SLIDES_DIR, f"slide_{n:03d}.png")
    img.save(path, "PNG")
    slides_data.append((path, 12))
    print(f"  Slide {n}/{TOTAL} generated")

    print(f"\nTotal slides generated: {n}")

def create_video():
    """Create MP4 from slides using ffmpeg."""
    print("\nCreating video with ffmpeg...")
    concat_file = os.path.join(SLIDES_DIR, "concat.txt")
    with open(concat_file, "w") as f:
        for path, dur in slides_data:
            f.write(f"file '{path}'\n")
            f.write(f"duration {dur}\n")
        # Repeat last frame to avoid cutting
        if slides_data:
            f.write(f"file '{slides_data[-1][0]}'\n")

    total_dur = sum(d for _, d in slides_data)
    print(f"  Total duration: {total_dur} seconds ({total_dur/60:.1f} minutes)")

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-vf", "scale=1920:1080",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "30",
        "-pix_fmt", "yuv420p",
        "-r", "1",
        VIDEO_PATH,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ffmpeg error: {result.stderr[-500:]}")
        # Try with higher compression
        cmd[-4] = "35"
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"  ffmpeg retry error: {result.stderr[-500:]}")
            return False

    size_mb = os.path.getsize(VIDEO_PATH) / (1024*1024)
    print(f"  Video created: {VIDEO_PATH}")
    print(f"  Size: {size_mb:.1f} MB")
    return True

def send_email():
    """Send the video via email."""
    print("\nSending email...")
    video_size = os.path.getsize(VIDEO_PATH) / (1024*1024)

    msg = MIMEMultipart()
    msg["From"] = SMTP_USER
    msg["To"] = EMAIL_TO
    msg["Subject"] = "Sarah -- Video Presentacion Completa (15 min)"

    if video_size <= 24:
        body = f"""Hola,

Adjunto la presentacion completa en video de Sarah, el chatbot IA + VoIP de Redegal.

Duracion: ~15 minutos
Slides: {len(slides_data)}
Tamano: {video_size:.1f} MB

Secciones:
1. Introduccion
2. Instalacion (un comando)
3. Configuracion completa
4. Experiencia del chatbot
5. SarahPhone (VoIP Click2Call)
6. Dashboard de agentes
7. Integraciones y plugins
8. ROI y cierre

Saludos,
Sarah Video Generator
"""
        msg.attach(MIMEText(body, "plain"))
        with open(VIDEO_PATH, "rb") as f:
            attachment = MIMEBase("application", "octet-stream")
            attachment.set_payload(f.read())
        encoders.encode_base64(attachment)
        attachment.add_header("Content-Disposition", f"attachment; filename=Sarah-Presentacion-Completa.mp4")
        msg.attach(attachment)
        print(f"  Video attached ({video_size:.1f} MB)")
    else:
        body = f"""Hola,

Se ha generado la presentacion completa en video de Sarah.

NOTA: El archivo pesa {video_size:.1f} MB (excede el limite de 25 MB de Gmail),
por lo que no se puede adjuntar. El video esta disponible en:

  {VIDEO_PATH}

Duracion: ~15 minutos
Slides: {len(slides_data)}

Secciones:
1. Introduccion
2. Instalacion (un comando)
3. Configuracion completa
4. Experiencia del chatbot
5. SarahPhone (VoIP Click2Call)
6. Dashboard de agentes
7. Integraciones y plugins
8. ROI y cierre

Saludos,
Sarah Video Generator
"""
        msg.attach(MIMEText(body, "plain"))
        print(f"  Video too large for attachment ({video_size:.1f} MB), sending info only")

    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, EMAIL_TO, msg.as_string())
        server.quit()
        print("  Email sent successfully!")
        return True
    except Exception as e:
        print(f"  Email error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Sarah — Video Presentation Generator")
    print("=" * 60)
    gen_all()
    if create_video():
        send_email()
    print("\nDone!")
