#!/usr/bin/env python3
"""
Sarah Screencast Video Generator
=================================
Creates a professional narrated screencast of the Sarah chatbot application.
Uses Playwright for real screenshots, Pillow for mockup slides,
edge-tts for narration, and ffmpeg for video compilation.
"""

import os
import sys
import time
import json
import asyncio
import subprocess
import smtplib
import math
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ─────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────

WIDTH, HEIGHT = 1920, 1080
DOCS_DIR = Path("/Users/jorgevazquez/sarah/docs")
TEMP_DIR = DOCS_DIR / "screencast-temp"
OUTPUT_VIDEO = DOCS_DIR / "Sarah-Screencast.mp4"

# URLs
WIDGET_TEST_URL = "http://localhost:9456/widget/test.html"
HEALTH_URL = "http://localhost:9456/health"
DASHBOARD_URL = "http://localhost:9456/dashboard/"

# Fonts
FONT_MONO = "/System/Library/Fonts/Menlo.ttc"
FONT_SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_SANS_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_SANS_ITALIC = "/System/Library/Fonts/Supplemental/Arial Italic.ttf"

# Colors
C_BG_DARK = "#0A0F1A"
C_BG_TERMINAL = "#1E1E2E"
C_ACCENT = "#00D4AA"
C_PRIMARY = "#007FFF"
C_SIDEBAR = "#0F172A"
C_LIGHT_BG = "#F8FAFC"
C_WHITE = "#FFFFFF"
C_GRAY = "#8892A4"
C_DARK_TEXT = "#1E293B"
C_SUCCESS = "#10B981"
C_WARNING = "#F59E0B"
C_ERROR = "#FF6B6B"
C_TERM_GREEN = "#50FA7B"
C_TERM_WHITE = "#F8F8F2"
C_TERM_YELLOW = "#F1FA8C"
C_TERM_CYAN = "#8BE9FD"
C_TERM_TITLEBAR = "#44475A"
C_TERM_RED = "#FF5555"
C_TERM_GRAY = "#6272A4"

# TTS
TTS_VOICE = "es-ES-ElviraNeural"

# ─────────────────────────────────────────────────
# Narration texts
# ─────────────────────────────────────────────────

NARRATIONS = {
    "00": "Bienvenidos a la guía completa de Sarah, el chatbot inteligente con voz integrada desarrollado por Redegal.",
    "01": "Así se ve Sarah integrada en la web corporativa. El botón circular aparece en la esquina inferior derecha, invitando al visitante a iniciar una conversación.",
    "02": "Al hacer clic, se abre el widget con una vista de bienvenida. El visitante puede seleccionar la línea de negocio sobre la que necesita información: Boostic, Binnacle, Marketing o Tech.",
    "03": "Sarah detecta automáticamente el idioma del navegador. Pero el usuario puede cambiarlo manualmente a español, inglés, portugués o gallego en cualquier momento.",
    "04": "La conversación fluye naturalmente. La inteligencia artificial responde con conocimiento real de los servicios de la empresa, inyectado desde una base de conocimiento contextual.",
    "05": "El modo oscuro se activa con un simple toggle. Todo el widget se adapta instantáneamente para entornos con poca luz.",
    "06": "Veamos la aplicación real corriendo. El endpoint de salud confirma que los tres servicios están funcionando: servidor, PostgreSQL y Redis.",
    "07": "Esta es la página de prueba del widget embebido en el servidor real, donde podemos verificar que todo funciona correctamente.",
    "08": "El dashboard de agentes requiere autenticación. Los roles disponibles son administrador, supervisor y agente.",
    "09": "La instalación comienza clonando el repositorio. Un solo comando y ya tenemos todo el código fuente.",
    "10": "El script de setup es interactivo. Genera automáticamente todos los secretos necesarios: token JWT, claves de API y contraseñas de base de datos. No hay que inventar nada.",
    "11": "Docker Compose levanta los cuatro servicios en paralelo: PostgreSQL para la base de datos, Redis para caché, el servidor Node.js y Janus como gateway WebRTC para las llamadas.",
    "12": "Verificamos la instalación con un simple curl al endpoint de salud. Los tres checks en verde confirman que todo está operativo.",
    "13": "El dashboard muestra la cola de conversaciones en tiempo real. Cada entrada indica el tiempo de espera, los mensajes sin leer y la línea de negocio.",
    "14": "Al abrir una conversación, el agente ve el historial completo. Puede responder directamente, usar atajos de teclado con respuestas predefinidas, o añadir notas internas.",
    "15": "La pestaña de Leads presenta el pipeline de prospectos con puntuación de calidad automática, desde nuevo hasta convertido o perdido.",
    "16": "Analytics muestra métricas diarias: resolución de chats, puntuación CSAT, tiempo medio de respuesta y tasa de conversión de leads.",
    "17": "El historial de llamadas incluye duración, grabaciones reproducibles en el navegador y transcripciones automáticas generadas por inteligencia artificial.",
    "18": "El sistema de entrenamiento permite revisar las respuestas del bot. Cuando una conversación recibe buena valoración, las respuestas se guardan automáticamente como patrones aprendidos.",
    "19": "El wallboard está diseñado para pantallas de call center. Se actualiza cada cinco segundos con las métricas clave: llamadas activas, chats en cola, agentes conectados y cumplimiento de SLA.",
    "20": "La arquitectura Docker Compose orquesta cuatro servicios. PostgreSQL con extensión pgvector para búsqueda semántica, Redis para caché y sesiones, el servidor Node.js con Express y WebSocket, y Janus como gateway WebRTC.",
    "21": "La configuración se organiza en categorías: branding, tipografía, layout, funcionalidades, idiomas, líneas de negocio, horario comercial y proveedores de IA.",
    "22": "El sistema de IA utiliza tres proveedores con fallback automático. Claude Sonnet como primario por su calidad, Gemini Flash como respaldo gratuito, y GPT cuatro o mini como última opción.",
    "23": "Las integraciones CRM incluyen Salesforce con OAuth2, HubSpot con API key, y adaptadores preparados para Zoho y Pipedrive. Cada lead capturado se sincroniza automáticamente.",
    "24": "El flujo de llamadas VoIP es así: el navegador establece una conexión WebRTC con el gateway Janus, que la convierte a protocolo SIP y la enruta a la centralita Vozelia, donde suena la extensión del agente.",
    "25": "Sarah se integra con las principales plataformas: plugin de WordPress con página de ajustes, plantilla Liquid para Shopify y módulo PHTML para Magento dos.",
    "26": "Gracias por ver esta presentación. Sarah está disponible para implementación inmediata. Para más información, contacte con jorge punto vázquez arroba redegal punto com.",
}


# ─────────────────────────────────────────────────
# Font helpers
# ─────────────────────────────────────────────────

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

def font_mono(size=20):
    return get_font(FONT_MONO, size)

def font_sans(size=20):
    return get_font(FONT_SANS, size)

def font_bold(size=20):
    return get_font(FONT_SANS_BOLD, size)

def font_italic(size=20):
    return get_font(FONT_SANS_ITALIC, size)

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


# ─────────────────────────────────────────────────
# Drawing helpers
# ─────────────────────────────────────────────────

def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    """Draw a rounded rectangle."""
    x0, y0, x1, y1 = xy
    # Clamp radius to half the smallest dimension
    r = min(radius, (x1 - x0) // 2, (y1 - y0) // 2)
    if r < 1:
        draw.rectangle([x0, y0, x1, y1], fill=fill, outline=outline, width=width)
        return
    # Main body
    draw.rectangle([x0+r, y0, x1-r, y1], fill=fill)
    draw.rectangle([x0, y0+r, x1, y1-r], fill=fill)
    # Corners
    draw.pieslice([x0, y0, x0+2*r, y0+2*r], 180, 270, fill=fill)
    draw.pieslice([x1-2*r, y0, x1, y0+2*r], 270, 360, fill=fill)
    draw.pieslice([x0, y1-2*r, x0+2*r, y1], 90, 180, fill=fill)
    draw.pieslice([x1-2*r, y1-2*r, x1, y1], 0, 90, fill=fill)
    if outline:
        # Top/bottom edges
        draw.line([x0+r, y0, x1-r, y0], fill=outline, width=width)
        draw.line([x0+r, y1, x1-r, y1], fill=outline, width=width)
        # Left/right edges
        draw.line([x0, y0+r, x0, y1-r], fill=outline, width=width)
        draw.line([x1, y0+r, x1, y1-r], fill=outline, width=width)
        # Corner arcs
        draw.arc([x0, y0, x0+2*r, y0+2*r], 180, 270, fill=outline, width=width)
        draw.arc([x1-2*r, y0, x1, y0+2*r], 270, 360, fill=outline, width=width)
        draw.arc([x0, y1-2*r, x0+2*r, y1], 90, 180, fill=outline, width=width)
        draw.arc([x1-2*r, y1-2*r, x1, y1], 0, 90, fill=outline, width=width)


def draw_arrow(draw, start, end, fill="#FFFFFF", width=2, head_size=12):
    """Draw a line with an arrowhead."""
    draw.line([start, end], fill=fill, width=width)
    # Arrowhead
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = math.sqrt(dx*dx + dy*dy)
    if length == 0:
        return
    udx, udy = dx/length, dy/length
    # Perpendicular
    px, py = -udy, udx
    # Arrowhead points
    p1 = (end[0] - head_size*udx + head_size*0.4*px,
          end[1] - head_size*udy + head_size*0.4*py)
    p2 = (end[0] - head_size*udx - head_size*0.4*px,
          end[1] - head_size*udy - head_size*0.4*py)
    draw.polygon([end, p1, p2], fill=fill)


def draw_sidebar(draw, active_tab="Queue", tabs=None):
    """Draw dashboard sidebar."""
    if tabs is None:
        tabs = ["Queue", "Chat", "Leads", "Analytics", "Calls", "Training", "Wallboard", "Settings"]
    # Sidebar background
    draw.rectangle([0, 0, 260, HEIGHT], fill=C_SIDEBAR)

    # Logo area
    draw.rectangle([0, 0, 260, 70], fill="#0B1120")
    f = font_bold(26)
    draw.text((30, 22), "Sarah", fill=C_ACCENT, font=f)
    f2 = font_sans(14)
    draw.text((110, 30), "Dashboard", fill=C_GRAY, font=f2)

    # Nav items
    y = 90
    icons = {"Queue": "Q", "Chat": "C", "Leads": "L", "Analytics": "A",
             "Calls": "P", "Training": "T", "Wallboard": "W", "Settings": "S"}
    for tab in tabs:
        is_active = tab == active_tab
        if is_active:
            draw.rectangle([0, y, 260, y+44], fill="#1E293B")
            draw.rectangle([0, y, 4, y+44], fill=C_ACCENT)
        icon_letter = icons.get(tab, tab[0])
        icon_f = font_bold(16)
        label_f = font_sans(15) if not is_active else font_bold(15)
        color = C_WHITE if is_active else C_GRAY
        # Icon circle
        cx, cy = 36, y + 22
        draw.ellipse([cx-12, cy-12, cx+12, cy+12],
                      fill=C_PRIMARY if is_active else "#1E293B",
                      outline="#334155" if not is_active else None)
        tw = draw.textlength(icon_letter, font=icon_f)
        draw.text((cx - tw/2, cy - 9), icon_letter, fill=C_WHITE, font=icon_f)
        draw.text((60, y + 12), tab, fill=color, font=label_f)
        y += 48

    # Bottom user
    draw.rectangle([0, HEIGHT-60, 260, HEIGHT], fill="#0B1120")
    draw.ellipse([20, HEIGHT-48, 44, HEIGHT-24], fill=C_PRIMARY)
    draw.text((28, HEIGHT-46), "J", fill=C_WHITE, font=font_bold(14))
    draw.text((54, HEIGHT-48), "Jorge V.", fill=C_WHITE, font=font_sans(14))
    draw.text((54, HEIGHT-32), "Admin", fill=C_GRAY, font=font_sans(12))


def draw_content_header(draw, title, subtitle=""):
    """Draw content area header."""
    draw.rectangle([260, 0, WIDTH, 70], fill=C_WHITE)
    draw.line([260, 70, WIDTH, 70], fill="#E2E8F0", width=1)
    draw.text((290, 20), title, fill=C_DARK_TEXT, font=font_bold(24))
    if subtitle:
        draw.text((290, 48), subtitle, fill=C_GRAY, font=font_sans(14))


def draw_card(draw, xy, title="", content_lines=None, shadow=True):
    """Draw a white card with optional shadow."""
    x0, y0, x1, y1 = xy
    if shadow:
        draw.rectangle([x0+3, y0+3, x1+3, y1+3], fill="#E2E8F0")
    draw_rounded_rect(draw, xy, 12, fill=C_WHITE)
    draw_rounded_rect(draw, xy, 12, outline="#E2E8F0", width=1)
    if title:
        draw.text((x0+20, y0+16), title, fill=C_DARK_TEXT, font=font_bold(16))
    if content_lines:
        cy = y0 + 48
        for line in content_lines:
            draw.text((x0+20, cy), line, fill=C_GRAY, font=font_sans(14))
            cy += 22


def text_center(draw, x, y, text, font, fill):
    """Draw centered text at (x,y)."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((x - tw/2, y - th/2), text, fill=fill, font=font)


# ─────────────────────────────────────────────────
# Terminal slide factory
# ─────────────────────────────────────────────────

def create_terminal_slide(lines, filename):
    """
    Create a terminal-style screenshot.
    lines: list of (text, color) tuples. Use None for blank line.
    """
    img = Image.new("RGB", (WIDTH, HEIGHT), C_BG_TERMINAL)
    draw = ImageDraw.Draw(img)

    # Title bar
    draw.rectangle([40, 30, WIDTH-40, 72], fill=C_TERM_TITLEBAR)
    # Traffic light dots
    for i, c in enumerate([C_TERM_RED, C_TERM_YELLOW, C_TERM_GREEN]):
        cx = 68 + i * 24
        cy = 51
        draw.ellipse([cx-7, cy-7, cx+7, cy+7], fill=c)
    # Title
    draw.text((WIDTH//2 - 80, 42), "Terminal - zsh", fill=C_GRAY, font=font_mono(14))

    # Terminal body
    draw.rectangle([40, 72, WIDTH-40, HEIGHT-30], fill=C_BG_TERMINAL)

    y = 100
    f = font_mono(18)
    for item in lines:
        if item is None:
            y += 28
            continue
        text, color = item
        draw.text((70, y), text, fill=color, font=f)
        y += 30

    img.save(TEMP_DIR / filename)
    print(f"  Created {filename}")


# ─────────────────────────────────────────────────
# Scene Group C: Terminal screenshots
# ─────────────────────────────────────────────────

def create_terminal_screenshots():
    print("\n[Scene C] Creating terminal screenshots...")

    # 09 - git clone
    create_terminal_slide([
        ("$ git clone https://github.com/jorgevazquez-vagojo/sarah.git", C_TERM_GREEN),
        ("Cloning into 'sarah'...", C_TERM_WHITE),
        ("remote: Enumerating objects: 847, done.", C_TERM_WHITE),
        ("remote: Counting objects: 100% (847/847), done.", C_TERM_WHITE),
        ("remote: Compressing objects: 100% (412/412), done.", C_TERM_WHITE),
        ("remote: Total 847 (delta 389), reused 791 (delta 341)", C_TERM_WHITE),
        ("Receiving objects: 100% (847/847), 2.31 MiB | 12.4 MiB/s, done.", C_TERM_WHITE),
        ("Resolving deltas: 100% (389/389), done.", C_TERM_WHITE),
        None,
        ("$ cd sarah", C_TERM_GREEN),
        ("~/sarah $", C_TERM_CYAN),
    ], "screenshot_09_terminal_clone.png")

    # 10 - setup.sh
    create_terminal_slide([
        ("~/sarah $ ./setup.sh", C_TERM_GREEN),
        None,
        ("  Sarah - Setup Wizard", C_TERM_CYAN),
        ("  =====================", C_TERM_CYAN),
        None,
        ("[1/5] Generating JWT secret...", C_TERM_YELLOW),
        ("  JWT_SECRET=a7f3c9e2b1d4...  (auto-generated)", C_TERM_WHITE),
        ("[2/5] Generating session secret...", C_TERM_YELLOW),
        ("  SESSION_SECRET=k8m2p5r7t0...  (auto-generated)", C_TERM_WHITE),
        ("[3/5] Creating PostgreSQL credentials...", C_TERM_YELLOW),
        ("  DB_PASSWORD=x4w6v9y1z3...  (auto-generated)", C_TERM_WHITE),
        ("[4/5] Setting Redis password...", C_TERM_YELLOW),
        ("  REDIS_PASSWORD=q2n5s8u0...  (auto-generated)", C_TERM_WHITE),
        ("[5/5] Writing .env file...", C_TERM_YELLOW),
        None,
        ("  .env created with 24 variables", C_TERM_GREEN + ""),
        ("  All secrets auto-generated. Ready to deploy!", C_TERM_GREEN + ""),
    ], "screenshot_10_terminal_setup.png")

    # 11 - docker compose up
    create_terminal_slide([
        ("~/sarah $ docker compose up -d", C_TERM_GREEN),
        None,
        ("[+] Running 5/5", C_TERM_CYAN),
        ("  Network sarah_default     Created     0.1s", C_TERM_WHITE),
        ("  Container sarah-postgres   Started     1.2s", C_TERM_YELLOW),
        ("  Container sarah-redis      Started     0.8s", C_TERM_YELLOW),
        ("  Container sarah-janus      Started     1.5s", C_TERM_YELLOW),
        ("  Container sarah-server     Started     2.1s", C_TERM_YELLOW),
        None,
        ("~/sarah $ docker compose ps", C_TERM_GREEN),
        None,
        ("NAME              STATUS          PORTS", C_TERM_CYAN),
        ("sarah-postgres    Up 10 seconds   5432/tcp", C_TERM_WHITE),
        ("sarah-redis       Up 10 seconds   6379/tcp", C_TERM_WHITE),
        ("sarah-janus       Up 10 seconds   8088/tcp, 8188/tcp", C_TERM_WHITE),
        ("sarah-server      Up 8 seconds    0.0.0.0:9456->9456/tcp", C_TERM_WHITE),
    ], "screenshot_11_terminal_docker.png")

    # 12 - curl health
    create_terminal_slide([
        ("~/sarah $ curl -s localhost:9456/health | python3 -m json.tool", C_TERM_GREEN),
        None,
        ("{", C_TERM_WHITE),
        ('    "server": "ok",', C_TERM_GREEN + ""),
        ('    "postgres": "ok",', C_TERM_GREEN + ""),
        ('    "redis": "ok"', C_TERM_GREEN + ""),
        ("}", C_TERM_WHITE),
        None,
        None,
        ("~/sarah $ curl -s localhost:9456/api/config/widget | python3 -m json.tool | head -8", C_TERM_GREEN),
        None,
        ("{", C_TERM_WHITE),
        ('    "branding": {', C_TERM_CYAN),
        ('        "companyName": "Redegal",', C_TERM_WHITE),
        ('        "primaryColor": "#007FFF",', C_TERM_WHITE),
        ('        "accentColor": "#00D4AA"', C_TERM_WHITE),
        ('    },', C_TERM_CYAN),
        ("...", C_TERM_GRAY),
    ], "screenshot_12_terminal_health.png")


# ─────────────────────────────────────────────────
# Scene Group D: Dashboard mockups
# ─────────────────────────────────────────────────

def create_dashboard_queue():
    """13 - Queue view"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_LIGHT_BG)
    draw = ImageDraw.Draw(img)
    draw_sidebar(draw, active_tab="Queue")
    draw_content_header(draw, "Conversation Queue", "12 active conversations")

    # Stats bar
    stats = [("In Queue", "5", C_WARNING), ("Active", "7", C_SUCCESS),
             ("Avg Wait", "1m 23s", C_PRIMARY), ("Today", "48", C_GRAY)]
    sx = 290
    for label, val, color in stats:
        draw_rounded_rect(draw, [sx, 90, sx+180, 150], 8, fill=C_WHITE)
        draw.text((sx+15, 98), label, fill=C_GRAY, font=font_sans(12))
        draw.text((sx+15, 118), val, fill=color, font=font_bold(22))
        sx += 200

    # Conversation list
    conversations = [
        ("Maria Garcia", "Boostic", "2 min", "3", "Hola, necesito info sobre SEO..."),
        ("Carlos Ruiz", "Tech", "5 min", "1", "Tenemos un problema con la API..."),
        ("Ana Lopez", "Marketing", "1 min", "2", "Quiero contratar campana SEM..."),
        ("Pedro Santos", "Binnacle", "8 min", "5", "Dashboard no carga datos de..."),
        ("Laura Martin", "Boostic", "3 min", "1", "Presupuesto para SEO internac..."),
        ("Miguel Torres", "Tech", "12 min", "4", "Migracion a cloud, plazos?..."),
        ("Elena Vidal", "Marketing", "< 1 min", "0", "Redes sociales para retail..."),
        ("David Fernandez", "Binnacle", "6 min", "2", "Integracion con Tableau..."),
    ]

    y = 175
    # Header row
    draw.rectangle([280, y, WIDTH-30, y+36], fill="#F1F5F9")
    headers = [("Visitor", 310), ("Business Line", 620), ("Wait", 850), ("Msgs", 970), ("Last Message", 1080)]
    for h, hx in headers:
        draw.text((hx, y+10), h, fill=C_GRAY, font=font_bold(13))
    y += 40

    line_colors = {"Boostic": "#6366F1", "Tech": "#EC4899", "Marketing": "#F59E0B", "Binnacle": "#10B981"}
    for i, (name, line, wait, msgs, msg) in enumerate(conversations):
        bg = C_WHITE if i % 2 == 0 else "#F8FAFC"
        draw.rectangle([280, y, WIDTH-30, y+52], fill=bg)
        # Avatar
        draw.ellipse([310, y+10, 342, y+42], fill=C_PRIMARY)
        draw.text((319, y+16), name[0], fill=C_WHITE, font=font_bold(14))
        draw.text((352, y+17), name, fill=C_DARK_TEXT, font=font_sans(14))
        # Business line badge
        lc = line_colors.get(line, C_PRIMARY)
        draw_rounded_rect(draw, [620, y+14, 620+len(line)*9+20, y+38], 10, fill=lc)
        draw.text((630, y+17), line, fill=C_WHITE, font=font_bold(11))
        # Wait
        draw.text((850, y+17), wait, fill=C_WARNING if "min" in wait else C_SUCCESS, font=font_sans(14))
        # Msgs
        if int(msgs) > 0:
            draw_rounded_rect(draw, [970, y+14, 998, y+38], 10, fill=C_ERROR)
            draw.text((978, y+17), msgs, fill=C_WHITE, font=font_bold(12))
        else:
            draw.text((978, y+17), msgs, fill=C_GRAY, font=font_sans(14))
        # Message
        draw.text((1080, y+17), msg, fill=C_GRAY, font=font_sans(13))
        y += 54

    img.save(TEMP_DIR / "screenshot_13_dashboard_queue.png")
    print("  Created screenshot_13_dashboard_queue.png")


def create_dashboard_chat():
    """14 - Chat conversation view"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_LIGHT_BG)
    draw = ImageDraw.Draw(img)
    draw_sidebar(draw, active_tab="Chat")
    draw_content_header(draw, "Conversation", "Maria Garcia - Boostic")

    # Left panel - conversation list (mini)
    draw.rectangle([260, 70, 520, HEIGHT], fill=C_WHITE)
    draw.line([520, 70, 520, HEIGHT], fill="#E2E8F0", width=1)
    contacts = [("Maria Garcia", "Active", True), ("Carlos Ruiz", "Active", False),
                ("Ana Lopez", "Waiting", False), ("Pedro Santos", "Active", False)]
    cy = 85
    for name, status, active in contacts:
        if active:
            draw.rectangle([260, cy, 520, cy+60], fill="#EFF6FF")
            draw.rectangle([260, cy, 264, cy+60], fill=C_PRIMARY)
        draw.ellipse([280, cy+14, 310, cy+44], fill=C_PRIMARY if active else C_GRAY)
        draw.text((288, cy+20), name[0], fill=C_WHITE, font=font_bold(12))
        draw.text((320, cy+16), name, fill=C_DARK_TEXT, font=font_bold(13))
        sc = C_SUCCESS if status == "Active" else C_WARNING
        draw.text((320, cy+36), status, fill=sc, font=font_sans(11))
        cy += 64

    # Right panel - messages
    content_x = 540
    messages = [
        ("bot", "Hola Maria, bienvenida a Redegal. Soy Sarah, tu asistente virtual. En que puedo ayudarte hoy?"),
        ("user", "Hola! Necesito informacion sobre servicios de SEO internacional para nuestra tienda online."),
        ("bot", "Excelente! Nuestro equipo de Boostic es especialista en SEO internacional. Trabajamos con marcas como Lacoste y Adolfo Dominguez.\n\nPodemos ayudarte con:\n- Estrategia SEO multiidioma\n- Optimizacion tecnica\n- Link building internacional\n- Contenido localizado"),
        ("user", "Suena genial. Podrian darme un presupuesto?"),
        ("bot", "Por supuesto! Voy a conectarte con un especialista de Boostic que preparara una propuesta personalizada. Mientras tanto, puedo enviarte nuestro caso de exito con Lacoste. Te interesa?"),
    ]

    my = 90
    for sender, text in messages:
        is_bot = sender == "bot"
        max_w = 500
        # Simple word wrap
        words = text.split()
        wrapped_lines = []
        current_line = ""
        for word in words:
            test = current_line + (" " if current_line else "") + word
            if draw.textlength(test, font=font_sans(14)) > max_w:
                if current_line:
                    wrapped_lines.append(current_line)
                current_line = word
            else:
                current_line = test
        if current_line:
            wrapped_lines.append(current_line)

        bubble_h = len(wrapped_lines) * 22 + 20
        if is_bot:
            bx = content_x + 20
            bubble_color = "#F1F5F9"
            text_color = C_DARK_TEXT
        else:
            bx = WIDTH - 60 - max_w
            bubble_color = C_PRIMARY
            text_color = C_WHITE

        draw_rounded_rect(draw, [bx, my, bx + max_w + 30, my + bubble_h], 12, fill=bubble_color)

        ty = my + 10
        for line in wrapped_lines:
            draw.text((bx + 15, ty), line, fill=text_color, font=font_sans(14))
            ty += 22
        my += bubble_h + 12

    # Input box at bottom
    draw.rectangle([540, HEIGHT-70, WIDTH-20, HEIGHT-20], fill=C_WHITE)
    draw_rounded_rect(draw, [560, HEIGHT-60, WIDTH-140, HEIGHT-30], 20, fill="#F1F5F9", outline="#E2E8F0")
    draw.text((580, HEIGHT-52), "Escribe una respuesta...", fill=C_GRAY, font=font_sans(14))
    draw_rounded_rect(draw, [WIDTH-120, HEIGHT-58, WIDTH-40, HEIGHT-32], 14, fill=C_PRIMARY)
    draw.text((WIDTH-100, HEIGHT-54), "Enviar", fill=C_WHITE, font=font_bold(13))

    img.save(TEMP_DIR / "screenshot_14_dashboard_chat.png")
    print("  Created screenshot_14_dashboard_chat.png")


def create_dashboard_leads():
    """15 - Leads table"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_LIGHT_BG)
    draw = ImageDraw.Draw(img)
    draw_sidebar(draw, active_tab="Leads")
    draw_content_header(draw, "Leads Pipeline", "24 leads this month")

    # Pipeline summary cards
    pipeline = [("New", "8", C_PRIMARY), ("Contacted", "6", C_WARNING),
                ("Qualified", "5", C_ACCENT), ("Proposal", "3", "#6366F1"),
                ("Won", "2", C_SUCCESS)]
    px = 290
    for label, count, color in pipeline:
        draw_rounded_rect(draw, [px, 90, px+155, 160], 10, fill=C_WHITE)
        draw.rectangle([px, 90, px+155, 96], fill=color)
        draw.text((px+15, 106), label, fill=C_GRAY, font=font_sans(12))
        draw.text((px+15, 126), count, fill=C_DARK_TEXT, font=font_bold(24))
        px += 175

    # Table
    y = 185
    draw.rectangle([280, y, WIDTH-30, y+36], fill="#F1F5F9")
    cols = [("Name", 310), ("Company", 520), ("Line", 720), ("Score", 880), ("Status", 980), ("Created", 1130), ("Actions", 1320)]
    for h, hx in cols:
        draw.text((hx, y+10), h, fill=C_GRAY, font=font_bold(13))
    y += 40

    leads = [
        ("Maria Garcia", "TechStore SL", "Boostic", 92, "Qualified", "Feb 20"),
        ("Carlos Ruiz", "DataFlow Inc", "Tech", 85, "Proposal", "Feb 19"),
        ("Ana Lopez", "ModaMax SA", "Marketing", 78, "Contacted", "Feb 18"),
        ("Pedro Santos", "FinData Corp", "Binnacle", 71, "New", "Feb 17"),
        ("Laura Martin", "GlobalShop", "Boostic", 68, "Qualified", "Feb 16"),
        ("Miguel Torres", "CloudNine SL", "Tech", 64, "New", "Feb 15"),
        ("Elena Vidal", "RetailPro SA", "Marketing", 55, "Contacted", "Feb 14"),
        ("David Fernandez", "Analytics360", "Binnacle", 48, "New", "Feb 13"),
    ]

    status_colors = {"New": C_PRIMARY, "Contacted": C_WARNING, "Qualified": C_ACCENT,
                     "Proposal": "#6366F1", "Won": C_SUCCESS}
    line_colors = {"Boostic": "#6366F1", "Tech": "#EC4899", "Marketing": "#F59E0B", "Binnacle": "#10B981"}

    for i, (name, company, line, score, status, created) in enumerate(leads):
        bg = C_WHITE if i % 2 == 0 else "#F8FAFC"
        draw.rectangle([280, y, WIDTH-30, y+48], fill=bg)
        draw.text((310, y+15), name, fill=C_DARK_TEXT, font=font_bold(14))
        draw.text((520, y+15), company, fill=C_GRAY, font=font_sans(14))
        # Line badge
        lc = line_colors.get(line, C_PRIMARY)
        draw_rounded_rect(draw, [720, y+12, 720+len(line)*8+16, y+36], 10, fill=lc)
        draw.text((728, y+15), line, fill=C_WHITE, font=font_bold(11))
        # Score bar
        bar_w = 60
        draw.rectangle([880, y+18, 880+bar_w, y+30], fill="#E2E8F0")
        sc = C_SUCCESS if score >= 70 else C_WARNING if score >= 50 else C_ERROR
        draw.rectangle([880, y+18, 880+int(bar_w*score/100), y+30], fill=sc)
        draw.text((948, y+15), str(score), fill=C_DARK_TEXT, font=font_bold(13))
        # Status
        stc = status_colors.get(status, C_GRAY)
        draw_rounded_rect(draw, [980, y+12, 980+len(status)*8+16, y+36], 10, fill=stc)
        draw.text((988, y+15), status, fill=C_WHITE, font=font_bold(11))
        # Created
        draw.text((1130, y+15), created, fill=C_GRAY, font=font_sans(13))
        # Actions dots
        for dot_i in range(3):
            draw.ellipse([1340+dot_i*8, y+20, 1344+dot_i*8, y+24], fill=C_GRAY)
        y += 50

    img.save(TEMP_DIR / "screenshot_15_dashboard_leads.png")
    print("  Created screenshot_15_dashboard_leads.png")


def create_dashboard_analytics():
    """16 - Analytics view"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_LIGHT_BG)
    draw = ImageDraw.Draw(img)
    draw_sidebar(draw, active_tab="Analytics")
    draw_content_header(draw, "Analytics", "February 2026")

    # KPI cards
    kpis = [
        ("Total Chats", "1,247", "+12%", C_SUCCESS),
        ("Avg Response", "1.8s", "-15%", C_SUCCESS),
        ("CSAT Score", "4.6/5", "+0.3", C_SUCCESS),
        ("Lead Conv.", "18.4%", "+2.1%", C_SUCCESS),
    ]
    kx = 290
    for label, val, change, cc in kpis:
        draw_rounded_rect(draw, [kx, 90, kx+190, 175], 10, fill=C_WHITE)
        draw.text((kx+20, 105), label, fill=C_GRAY, font=font_sans(13))
        draw.text((kx+20, 128), val, fill=C_DARK_TEXT, font=font_bold(28))
        draw.text((kx+130, 145), change, fill=cc, font=font_bold(13))
        kx += 210

    # Bar chart - Daily chats
    chart_x, chart_y = 290, 200
    draw_rounded_rect(draw, [chart_x, chart_y, chart_x+780, chart_y+360], 10, fill=C_WHITE)
    draw.text((chart_x+20, chart_y+15), "Daily Conversations", fill=C_DARK_TEXT, font=font_bold(16))

    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
            "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    values = [42, 55, 48, 63, 71, 28, 15, 47, 59, 52, 68, 75, 31, 18]
    max_val = max(values)
    bar_base_y = chart_y + 320
    bar_area_h = 240
    bw = 38
    gap = 14

    for i, (day, val) in enumerate(zip(days, values)):
        bx = chart_x + 40 + i * (bw + gap)
        bh = int((val / max_val) * bar_area_h)
        # Bar
        color = C_PRIMARY if i < 7 else C_ACCENT
        draw_rounded_rect(draw, [bx, bar_base_y - bh, bx+bw, bar_base_y], 4, fill=color)
        # Value
        draw.text((bx+8, bar_base_y - bh - 18), str(val), fill=C_DARK_TEXT, font=font_sans(11))
        # Day label
        draw.text((bx+6, bar_base_y + 5), day, fill=C_GRAY, font=font_sans(10))

    # CSAT distribution - right side
    csat_x, csat_y = 1100, 200
    draw_rounded_rect(draw, [csat_x, csat_y, csat_x+400, csat_y+360], 10, fill=C_WHITE)
    draw.text((csat_x+20, csat_y+15), "CSAT Distribution", fill=C_DARK_TEXT, font=font_bold(16))

    csat_data = [(5, 52, C_SUCCESS), (4, 28, C_ACCENT), (3, 12, C_WARNING), (2, 5, "#F97316"), (1, 3, C_ERROR)]
    sy = csat_y + 60
    for score, pct, color in csat_data:
        draw.text((csat_x+20, sy+2), f"{score}", fill=C_DARK_TEXT, font=font_bold(16))
        # Stars
        for s in range(5):
            sc = color if s < score else "#E2E8F0"
            draw.text((csat_x+45+s*18, sy+2), "*", fill=sc, font=font_bold(16))
        # Bar
        bar_max_w = 200
        draw.rectangle([csat_x+145, sy+4, csat_x+145+bar_max_w, sy+22], fill="#E2E8F0")
        draw.rectangle([csat_x+145, sy+4, csat_x+145+int(bar_max_w*pct/100), sy+22], fill=color)
        draw.text((csat_x+355, sy+3), f"{pct}%", fill=C_DARK_TEXT, font=font_bold(14))
        sy += 48

    # Response time trend - bottom
    rt_x, rt_y = 290, 580
    draw_rounded_rect(draw, [rt_x, rt_y, rt_x+1210, rt_y+210], 10, fill=C_WHITE)
    draw.text((rt_x+20, rt_y+15), "Response Time Trend (seconds)", fill=C_DARK_TEXT, font=font_bold(16))

    times = [3.2, 2.8, 2.5, 2.9, 2.1, 1.9, 2.0, 1.8, 1.7, 1.9, 1.6, 1.5, 1.8, 1.4]
    max_t = 4.0
    line_points = []
    for i, t in enumerate(times):
        lx = rt_x + 60 + i * 80
        ly = rt_y + 180 - int((t / max_t) * 140)
        line_points.append((lx, ly))

    for i in range(len(line_points)-1):
        draw.line([line_points[i], line_points[i+1]], fill=C_PRIMARY, width=3)
    for pt in line_points:
        draw.ellipse([pt[0]-5, pt[1]-5, pt[0]+5, pt[1]+5], fill=C_PRIMARY)

    img.save(TEMP_DIR / "screenshot_16_dashboard_analytics.png")
    print("  Created screenshot_16_dashboard_analytics.png")


def create_dashboard_calls():
    """17 - Calls history"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_LIGHT_BG)
    draw = ImageDraw.Draw(img)
    draw_sidebar(draw, active_tab="Calls")
    draw_content_header(draw, "Call History", "SarahPhone VoIP")

    # Stats
    stats = [("Today", "12", C_PRIMARY), ("Avg Duration", "3m 42s", C_ACCENT),
             ("Answered", "89%", C_SUCCESS), ("Missed", "3", C_ERROR)]
    sx = 290
    for label, val, color in stats:
        draw_rounded_rect(draw, [sx, 90, sx+190, 160], 10, fill=C_WHITE)
        draw.text((sx+15, 100), label, fill=C_GRAY, font=font_sans(12))
        draw.text((sx+15, 122), val, fill=color, font=font_bold(24))
        sx += 210

    # Calls table
    y = 185
    draw.rectangle([280, y, WIDTH-30, y+36], fill="#F1F5F9")
    cols = [("Caller", 310), ("Agent", 520), ("Duration", 700), ("Status", 830), ("Time", 980), ("Transcript", 1120)]
    for h, hx in cols:
        draw.text((hx, y+10), h, fill=C_GRAY, font=font_bold(13))
    y += 40

    calls = [
        ("+34 981 234 567", "Jorge V.", "4:23", "Completed", "10:45", "Cliente pregunta por plazos de entrega..."),
        ("+34 986 345 678", "Ana M.", "2:15", "Completed", "10:32", "Consulta sobre facturacion Q4..."),
        ("+34 912 456 789", "Carlos R.", "0:00", "Missed", "10:28", ""),
        ("+34 933 567 890", "Jorge V.", "6:47", "Completed", "10:15", "Soporte tecnico, error en dashboard..."),
        ("+34 981 678 901", "Laura P.", "3:02", "Completed", "09:58", "Quiere ampliar contrato de Boostic..."),
        ("+34 986 789 012", "Ana M.", "1:34", "Transferred", "09:45", "Derivado a departamento comercial..."),
        ("+34 912 890 123", "Carlos R.", "5:11", "Completed", "09:30", "Revision de resultados SEO mensual..."),
        ("+34 933 901 234", "Laura P.", "0:00", "Missed", "09:22", ""),
    ]

    status_colors = {"Completed": C_SUCCESS, "Missed": C_ERROR, "Transferred": C_WARNING}

    for i, (caller, agent, dur, status, time_s, transcript) in enumerate(calls):
        bg = C_WHITE if i % 2 == 0 else "#F8FAFC"
        draw.rectangle([280, y, WIDTH-30, y+50], fill=bg)
        # Phone icon
        draw.text((310, y+16), caller, fill=C_DARK_TEXT, font=font_mono(13))
        draw.text((520, y+16), agent, fill=C_DARK_TEXT, font=font_sans(14))
        draw.text((700, y+16), dur, fill=C_DARK_TEXT, font=font_mono(14))
        # Status badge
        sc = status_colors.get(status, C_GRAY)
        draw_rounded_rect(draw, [830, y+12, 830+len(status)*8+16, y+36], 10, fill=sc)
        draw.text((838, y+15), status, fill=C_WHITE, font=font_bold(11))
        draw.text((980, y+16), time_s, fill=C_GRAY, font=font_sans(13))
        # Transcript preview
        if transcript:
            draw.text((1120, y+16), transcript[:35]+"...", fill=C_GRAY, font=font_italic(12))
        else:
            draw.text((1120, y+16), "-- no recording --", fill="#CBD5E1", font=font_italic(12))
        y += 52

    img.save(TEMP_DIR / "screenshot_17_dashboard_calls.png")
    print("  Created screenshot_17_dashboard_calls.png")


def create_dashboard_training():
    """18 - Training tab"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_LIGHT_BG)
    draw = ImageDraw.Draw(img)
    draw_sidebar(draw, active_tab="Training")
    draw_content_header(draw, "Bot Training", "Review and improve AI responses")

    # Stats
    stats = [("Pending Review", "14", C_WARNING), ("Approved", "328", C_SUCCESS),
             ("Rejected", "12", C_ERROR), ("Accuracy", "96.4%", C_PRIMARY)]
    sx = 290
    for label, val, color in stats:
        draw_rounded_rect(draw, [sx, 90, sx+190, 160], 10, fill=C_WHITE)
        draw.text((sx+15, 100), label, fill=C_GRAY, font=font_sans(12))
        draw.text((sx+15, 122), val, fill=color, font=font_bold(24))
        sx += 210

    # Training entries
    entries = [
        ("User: Cual es el precio del servicio Boostic?",
         "Bot: Los servicios de Boostic se personalizan segun tus necesidades. Para un presupuesto a medida, nuestro equipo comercial te atendera encantado.",
         "good", "CSAT: 5/5"),
        ("User: Puedo hablar con un humano?",
         "Bot: Por supuesto. Te conecto ahora con un agente disponible. El tiempo de espera estimado es de 2 minutos.",
         "good", "CSAT: 4/5"),
        ("User: Como funciona la facturacion?",
         "Bot: No tengo informacion sobre facturacion. Le recomiendo contactar con administracion.",
         "bad", "CSAT: 2/5"),
        ("User: Teneis oficina en Mexico?",
         "Bot: Si, nuestra oficina de Ciudad de Mexico se encuentra en Paseo de la Reforma. Ahi atendemos el mercado latinoamericano.",
         "good", "CSAT: 5/5"),
    ]

    y = 185
    for user_msg, bot_msg, rating, csat in entries:
        card_h = 130
        draw_rounded_rect(draw, [280, y, WIDTH-30, y+card_h], 10, fill=C_WHITE)
        # Rating indicator
        ind_color = C_SUCCESS if rating == "good" else C_ERROR
        draw.rectangle([280, y, 286, y+card_h], fill=ind_color)
        # User message
        draw.text((310, y+15), user_msg, fill=C_DARK_TEXT, font=font_sans(14))
        # Bot response
        # Wrap bot response
        draw.text((310, y+45), bot_msg[:90], fill=C_GRAY, font=font_sans(13))
        if len(bot_msg) > 90:
            draw.text((310, y+65), bot_msg[90:180], fill=C_GRAY, font=font_sans(13))
        # Rating badge
        badge_text = "Approved" if rating == "good" else "Needs Review"
        badge_color = C_SUCCESS if rating == "good" else C_ERROR
        draw_rounded_rect(draw, [310, y+92, 310+len(badge_text)*8+20, y+114], 10, fill=badge_color)
        draw.text((320, y+95), badge_text, fill=C_WHITE, font=font_bold(12))
        # CSAT
        draw.text((500, y+95), csat, fill=C_GRAY, font=font_sans(13))
        # Action buttons
        draw_rounded_rect(draw, [WIDTH-250, y+90, WIDTH-170, y+116], 8, fill=C_SUCCESS)
        draw.text((WIDTH-240, y+94), "Approve", fill=C_WHITE, font=font_bold(12))
        draw_rounded_rect(draw, [WIDTH-150, y+90, WIDTH-70, y+116], 8, fill=C_ERROR)
        draw.text((WIDTH-140, y+94), "Reject", fill=C_WHITE, font=font_bold(12))
        y += card_h + 15

    img.save(TEMP_DIR / "screenshot_18_dashboard_training.png")
    print("  Created screenshot_18_dashboard_training.png")


def create_wallboard():
    """19 - Wallboard KPI display"""
    img = Image.new("RGB", (WIDTH, HEIGHT), "#0B1120")
    draw = ImageDraw.Draw(img)

    # Top bar
    draw.rectangle([0, 0, WIDTH, 60], fill="#000000")
    draw.text((30, 16), "Sarah Wallboard", fill=C_ACCENT, font=font_bold(24))
    draw.text((WIDTH-250, 22), "Live  |  Auto-refresh 5s", fill=C_SUCCESS, font=font_sans(14))
    # Pulsing dot
    draw.ellipse([WIDTH-270, 26, WIDTH-260, 36], fill=C_SUCCESS)

    # Main KPI cards - big numbers
    kpis = [
        ("Active Calls", "3", C_PRIMARY, "+1 queue"),
        ("Chats in Queue", "7", C_WARNING, "2 urgent"),
        ("Agents Online", "5/8", C_SUCCESS, "3 in call"),
        ("SLA Compliance", "94.2%", C_ACCENT, "Target: 90%"),
    ]
    kx = 40
    kw = (WIDTH - 120) // 4
    for label, val, color, sub in kpis:
        draw_rounded_rect(draw, [kx, 80, kx+kw-20, 260], 16, fill="#111827")
        draw_rounded_rect(draw, [kx, 80, kx+kw-20, 86], 3, fill=color)
        draw.text((kx+30, 105), label, fill=C_GRAY, font=font_sans(16))
        text_center(draw, kx+(kw-20)//2, 175, val, font_bold(64), color)
        text_center(draw, kx+(kw-20)//2, 230, sub, font_sans(16), C_GRAY)
        kx += kw

    # Agent cards row
    agents = [
        ("Jorge V.", "In Call", "+34 981 234 567", "4:23", C_PRIMARY),
        ("Ana M.", "Available", "", "", C_SUCCESS),
        ("Carlos R.", "In Chat", "Maria Garcia", "2:15", C_WARNING),
        ("Laura P.", "In Call", "+34 986 789 012", "1:34", C_PRIMARY),
        ("Miguel T.", "Break", "", "", "#6366F1"),
        ("Elena S.", "Available", "", "", C_SUCCESS),
        ("David F.", "In Chat", "Pedro Santos", "5:02", C_WARNING),
        ("Sara G.", "Offline", "", "", C_ERROR),
    ]

    draw.text((40, 285), "Agent Status", fill=C_WHITE, font=font_bold(20))
    ax = 40
    ay = 320
    aw = (WIDTH - 120) // 4
    for i, (name, status, detail, dur, color) in enumerate(agents):
        row = i // 4
        col = i % 4
        x0 = 40 + col * aw
        y0 = 320 + row * 140
        draw_rounded_rect(draw, [x0, y0, x0+aw-20, y0+120], 12, fill="#111827")
        # Status dot
        draw.ellipse([x0+20, y0+20, x0+32, y0+32], fill=color)
        draw.text((x0+42, y0+18), name, fill=C_WHITE, font=font_bold(16))
        draw_rounded_rect(draw, [x0+20, y0+48, x0+20+len(status)*9+16, y0+70], 10, fill=color)
        draw.text((x0+28, y0+50), status, fill=C_WHITE, font=font_bold(12))
        if detail:
            draw.text((x0+20, y0+82), detail, fill=C_GRAY, font=font_mono(12))
            draw.text((x0+20, y0+100), dur, fill=C_WHITE, font=font_bold(14))

    # Bottom ticker
    draw.rectangle([0, HEIGHT-50, WIDTH, HEIGHT], fill="#000000")
    ticker = "  Avg Wait: 1m 23s  |  Chats Today: 48  |  Calls Today: 12  |  CSAT: 4.6/5  |  Resolution Rate: 87%  |  Longest Wait: 3m 45s  "
    draw.text((30, HEIGHT-38), ticker, fill=C_ACCENT, font=font_mono(16))

    img.save(TEMP_DIR / "screenshot_19_wallboard.png")
    print("  Created screenshot_19_wallboard.png")


# ─────────────────────────────────────────────────
# Scene Group E: Architecture/Config slides
# ─────────────────────────────────────────────────

def create_architecture():
    """20 - Docker Compose diagram"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_BG_DARK)
    draw = ImageDraw.Draw(img)

    # Title
    draw.text((WIDTH//2 - 200, 30), "Docker Compose Architecture", fill=C_WHITE, font=font_bold(32))
    draw.rectangle([WIDTH//2 - 200, 72, WIDTH//2 + 200, 74], fill=C_ACCENT)

    # Service boxes
    services = [
        ("PostgreSQL 16", "pgvector", "5432", "#336791", "PG", 200, 300),
        ("Redis 7", "Cache + Sessions", "6379", "#DC382D", "RD", 600, 300),
        ("Node.js Server", "Express + WS", "9456", "#68A063", "NJ", 1000, 300),
        ("Janus Gateway", "WebRTC/SIP", "8088", "#FF6B00", "JN", 1400, 300),
    ]

    for name, sub, port, color, initials, cx, cy in services:
        box_w, box_h = 280, 180
        x0, y0 = cx - box_w//2, cy
        x1, y1 = cx + box_w//2, cy + box_h
        # Shadow
        draw_rounded_rect(draw, [x0+4, y0+4, x1+4, y1+4], 16, fill="#050810")
        # Box
        draw_rounded_rect(draw, [x0, y0, x1, y1], 16, fill="#111827")
        # Top accent
        draw.rectangle([x0, y0, x1, y0+6], fill=color)
        # Icon circle
        draw.ellipse([cx-28, y0+25, cx+28, y0+81], fill=color)
        text_center(draw, cx, y0+53, initials, font_bold(22), C_WHITE)
        # Text
        text_center(draw, cx, y0+105, name, font_bold(18), C_WHITE)
        text_center(draw, cx, y0+130, sub, font_sans(14), C_GRAY)
        text_center(draw, cx, y0+155, f":{port}", font_mono(14), C_ACCENT)

    # Arrows: PG -> NJ, RD -> NJ, NJ -> JN
    arrow_y = 390
    draw_arrow(draw, (340, arrow_y), (860, arrow_y), fill="#334155", width=3, head_size=14)
    draw_arrow(draw, (740, arrow_y), (860, arrow_y), fill="#334155", width=3, head_size=14)
    draw_arrow(draw, (1140, arrow_y), (1260, arrow_y), fill="#334155", width=3, head_size=14)

    # Labels on arrows
    draw.text((550, 368), "queries", fill=C_GRAY, font=font_italic(13))
    draw.text((790, 368), "cache", fill=C_GRAY, font=font_italic(13))
    draw.text((1170, 368), "WebRTC", fill=C_GRAY, font=font_italic(13))

    # Network box
    draw_rounded_rect(draw, [120, 530, WIDTH-120, 620], 12, fill="#111827", outline="#334155", width=2)
    text_center(draw, WIDTH//2, 555, "Docker Network: sarah_default", fill=C_ACCENT, font=font_bold(18))
    text_center(draw, WIDTH//2, 585, "Internal communication via service names  |  Only port 9456 exposed externally", fill=C_GRAY, font=font_sans(14))

    # External clients
    clients = [
        ("Browser", "Widget + Dashboard", 300, 700),
        ("API Clients", "REST + WebSocket", 700, 700),
        ("SIP/PBX", "Vozelia Cloud", 1100, 700),
    ]
    for name, sub, cx, cy in clients:
        draw_rounded_rect(draw, [cx-120, cy, cx+120, cy+70], 12, fill="#1E293B", outline=C_ACCENT, width=1)
        text_center(draw, cx, cy+22, name, font_bold(16), C_WHITE)
        text_center(draw, cx, cy+48, sub, font_sans(12), C_GRAY)

    # Arrows from clients up
    draw_arrow(draw, (300, 700), (300, 625), fill=C_ACCENT, width=2)
    draw_arrow(draw, (700, 700), (700, 625), fill=C_ACCENT, width=2)
    draw_arrow(draw, (1100, 700), (1100, 625), fill=C_ACCENT, width=2)

    # Volumes
    draw.text((120, 820), "Volumes:", fill=C_WHITE, font=font_bold(16))
    volumes = ["postgres_data (persistent)", "redis_data (cache)", "uploads/ (media)", "logs/ (application)"]
    vx = 260
    for vol in volumes:
        draw_rounded_rect(draw, [vx, 810, vx+220, 840], 8, fill="#1E293B")
        draw.text((vx+10, 815), vol, fill=C_GRAY, font=font_mono(12))
        vx += 240

    img.save(TEMP_DIR / "screenshot_20_architecture.png")
    print("  Created screenshot_20_architecture.png")


def create_config():
    """21 - Settings panel mockup"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_LIGHT_BG)
    draw = ImageDraw.Draw(img)
    draw_sidebar(draw, active_tab="Settings")
    draw_content_header(draw, "Settings", "Widget configuration")

    # Config categories
    categories = [
        ("Branding", ["Company Name: Redegal", "Primary Color: #007FFF", "Accent Color: #00D4AA",
                       "Logo URL: /assets/logo.svg", "Favicon: /assets/favicon.ico"]),
        ("Typography", ["Heading Font: Inter", "Body Font: Inter", "Size Scale: 1.0",
                         "Font Weight: 400/600/700"]),
        ("Layout", ["Position: bottom-right", "Widget Width: 380px", "Widget Height: 600px",
                     "Border Radius: 16px", "Z-Index: 9999"]),
        ("Features", ["Chat: enabled", "VoIP (SarahPhone): enabled", "File Upload: enabled",
                       "Emoji Picker: enabled", "Dark Mode: enabled"]),
        ("Languages", ["Default: auto-detect", "Available: ES, EN, PT, GL",
                        "Fallback: Spanish", "RTL Support: no"]),
        ("Business Lines", ["Boostic (SEO/SEM)", "Binnacle (BI/Analytics)",
                             "Digital Marketing", "Digital Tech"]),
        ("Business Hours", ["Mon-Fri: 09:00-18:00", "Sat: 09:00-14:00", "Sun: closed",
                             "Timezone: Europe/Madrid"]),
        ("AI Providers", ["Primary: Claude Sonnet", "Fallback 1: Gemini Flash",
                           "Fallback 2: GPT-4o-mini", "Temperature: 0.3"]),
    ]

    x = 280
    y = 90
    col_w = (WIDTH - 300) // 2
    for i, (cat_name, items) in enumerate(categories):
        col = i % 2
        row = i // 2
        cx = 290 + col * col_w
        cy = 90 + row * 230
        card_h = 200
        draw_rounded_rect(draw, [cx, cy, cx+col_w-20, cy+card_h], 10, fill=C_WHITE)

        # Category header
        draw_rounded_rect(draw, [cx, cy, cx+col_w-20, cy+40], 10, fill=C_PRIMARY)
        draw.rectangle([cx, cy+20, cx+col_w-20, cy+40], fill=C_PRIMARY)
        draw.text((cx+15, cy+10), cat_name, fill=C_WHITE, font=font_bold(16))

        # Items
        iy = cy + 52
        for item in items[:4]:
            key_val = item.split(": ", 1)
            if len(key_val) == 2:
                draw.text((cx+15, iy), key_val[0] + ":", fill=C_GRAY, font=font_sans(13))
                draw.text((cx+160, iy), key_val[1], fill=C_DARK_TEXT, font=font_bold(13))
            else:
                draw.text((cx+15, iy), item, fill=C_DARK_TEXT, font=font_sans(13))
            iy += 30

    img.save(TEMP_DIR / "screenshot_21_config.png")
    print("  Created screenshot_21_config.png")


def create_ai_providers():
    """22 - AI Providers diagram"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_BG_DARK)
    draw = ImageDraw.Draw(img)

    draw.text((WIDTH//2 - 180, 40), "Multi-Provider AI System", fill=C_WHITE, font=font_bold(32))
    draw.rectangle([WIDTH//2 - 180, 82, WIDTH//2 + 180, 84], fill=C_ACCENT)

    # Three provider boxes
    providers = [
        ("Claude Sonnet", "Anthropic", "Primary", "#D97706", 300, 220),
        ("Gemini Flash", "Google", "Fallback (Free)", "#4285F4", 760, 220),
        ("GPT-4o-mini", "OpenAI", "Last Resort", "#10A37F", 1220, 220),
    ]

    for name, company, role, color, cx, cy in providers:
        bw, bh = 340, 240
        x0, y0 = cx - bw//2, cy
        x1, y1 = cx + bw//2, cy + bh
        draw_rounded_rect(draw, [x0, y0, x1, y1], 16, fill="#111827")
        draw.rectangle([x0, y0, x1, y0+8], fill=color)

        # Provider circle
        draw.ellipse([cx-40, y0+30, cx+40, y0+110], fill=color)
        text_center(draw, cx, y0+70, name.split()[0][0], font_bold(36), C_WHITE)

        text_center(draw, cx, y0+130, name, font_bold(20), C_WHITE)
        text_center(draw, cx, y0+158, company, font_sans(14), C_GRAY)
        draw_rounded_rect(draw, [cx-60, y0+180, cx+60, y0+210], 12, fill=color)
        text_center(draw, cx, y0+195, role, font_bold(12), C_WHITE)

    # Fallback arrows
    draw_arrow(draw, (470, 340), (590, 340), fill=C_WARNING, width=4, head_size=16)
    draw.text((490, 310), "if fails", fill=C_WARNING, font=font_bold(14))
    draw_arrow(draw, (930, 340), (1050, 340), fill=C_ERROR, width=4, head_size=16)
    draw.text((950, 310), "if fails", fill=C_ERROR, font=font_bold(14))

    # Features list below
    features = [
        "Context-aware responses with knowledge base injection",
        "Automatic language detection (ES, EN, PT, GL)",
        "Business line routing (Boostic, Binnacle, Marketing, Tech)",
        "Conversation memory with session persistence",
        "Lead scoring and qualification via AI analysis",
        "Configurable temperature and max tokens per provider",
    ]
    y = 520
    draw.text((300, y), "Key Features", fill=C_ACCENT, font=font_bold(22))
    y += 40
    for feat in features:
        draw.ellipse([310, y+6, 318, y+14], fill=C_ACCENT)
        draw.text((330, y), feat, fill=C_WHITE, font=font_sans(16))
        y += 36

    img.save(TEMP_DIR / "screenshot_22_ai_providers.png")
    print("  Created screenshot_22_ai_providers.png")


def create_crm():
    """23 - CRM integrations"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_BG_DARK)
    draw = ImageDraw.Draw(img)

    draw.text((WIDTH//2 - 150, 40), "CRM Integrations", fill=C_WHITE, font=font_bold(32))
    draw.rectangle([WIDTH//2 - 150, 82, WIDTH//2 + 150, 84], fill=C_ACCENT)

    crms = [
        ("Salesforce", "OAuth2 + REST API", "Full sync", "#00A1E0", "SF"),
        ("HubSpot", "API Key + Webhooks", "Full sync", "#FF7A59", "HS"),
        ("Zoho CRM", "REST API v2", "Adapter ready", "#DC2626", "ZO"),
        ("Pipedrive", "REST API + Webhooks", "Adapter ready", "#1D1D1D", "PD"),
    ]

    cx_start = 180
    cx_gap = 420
    for i, (name, auth, status, color, initials) in enumerate(crms):
        cx = cx_start + i * cx_gap
        cy = 150
        bw, bh = 340, 280
        x0, y0 = cx - bw//2 + 60, cy
        x1, y1 = cx + bw//2 + 60, cy + bh
        draw_rounded_rect(draw, [x0, y0, x1, y1], 16, fill="#111827")
        draw.rectangle([x0, y0, x1, y0+6], fill=color)

        # Logo circle
        ccx = (x0+x1)//2
        draw.ellipse([ccx-35, y0+25, ccx+35, y0+95], fill=color)
        text_center(draw, ccx, y0+60, initials, font_bold(28), C_WHITE)

        text_center(draw, ccx, y0+120, name, font_bold(20), C_WHITE)
        text_center(draw, ccx, y0+150, auth, font_sans(13), C_GRAY)

        # Status badge
        sc = C_SUCCESS if "Full" in status else C_WARNING
        draw_rounded_rect(draw, [ccx-60, y0+180, ccx+60, y0+206], 12, fill=sc)
        text_center(draw, ccx, y0+193, status, font_bold(12), C_WHITE)

        # Features
        if i < 2:  # Full sync
            feats = ["Contact sync", "Deal creation", "Activity log", "Custom fields"]
        else:
            feats = ["Contact sync", "Basic deals", "Coming soon", ""]
        fy = y0 + 220
        for feat in feats:
            if feat:
                draw.text((x0+20, fy), "- " + feat, fill=C_GRAY, font=font_sans(12))
                fy += 18

    # Data flow
    draw.text((WIDTH//2 - 100, 480), "Data Flow", fill=C_ACCENT, font=font_bold(22))

    flow_items = [
        ("Chat Lead Captured", 200, 550),
        ("AI Qualification", 520, 550),
        ("Score Assignment", 840, 550),
        ("CRM Sync", 1160, 550),
        ("Pipeline Update", 1480, 550),
    ]

    for label, fx, fy in flow_items:
        draw_rounded_rect(draw, [fx-100, fy, fx+100, fy+50], 12, fill="#1E293B", outline=C_ACCENT, width=1)
        text_center(draw, fx, fy+25, label, font_bold(13), C_WHITE)

    for i in range(len(flow_items)-1):
        x1 = flow_items[i][1] + 100
        x2 = flow_items[i+1][1] - 100
        draw_arrow(draw, (x1, 575), (x2, 575), fill=C_ACCENT, width=3, head_size=12)

    # Webhook events
    draw.text((200, 640), "Webhook Events:", fill=C_WHITE, font=font_bold(18))
    events = ["lead.created", "lead.updated", "lead.qualified", "chat.completed",
              "call.completed", "csat.submitted", "agent.assigned"]
    ex = 200
    ey = 675
    for event in events:
        draw_rounded_rect(draw, [ex, ey, ex+len(event)*9+20, ey+28], 8, fill="#1E293B")
        draw.text((ex+10, ey+5), event, fill=C_ACCENT, font=font_mono(13))
        ex += len(event)*9 + 30
        if ex > WIDTH - 200:
            ex = 200
            ey += 36

    img.save(TEMP_DIR / "screenshot_23_crm.png")
    print("  Created screenshot_23_crm.png")


def create_voip_flow():
    """24 - VoIP flow diagram"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_BG_DARK)
    draw = ImageDraw.Draw(img)

    draw.text((WIDTH//2 - 120, 30), "VoIP Call Flow", fill=C_WHITE, font=font_bold(32))
    draw.rectangle([WIDTH//2 - 120, 72, WIDTH//2 + 120, 74], fill=C_ACCENT)

    # Flow nodes
    nodes = [
        ("Browser", "SIP.js Client", "#3B82F6", 200, 250),
        ("WebRTC", "ICE/DTLS/SRTP", "#8B5CF6", 500, 250),
        ("Janus GW", "WebRTC-SIP Bridge", "#FF6B00", 800, 250),
        ("SIP Trunk", "UDP/TCP", "#10B981", 1100, 250),
        ("Vozelia PBX", "Cloud PBX", "#DC2626", 1400, 250),
    ]

    for name, sub, color, nx, ny in nodes:
        bw, bh = 220, 140
        x0, y0 = nx - bw//2, ny
        x1, y1 = nx + bw//2, ny + bh
        draw_rounded_rect(draw, [x0, y0, x1, y1], 14, fill="#111827")
        draw.rectangle([x0, y0, x1, y0+6], fill=color)
        draw.ellipse([nx-25, y0+20, nx+25, y0+70], fill=color)
        text_center(draw, nx, y0+45, name[0], font_bold(24), C_WHITE)
        text_center(draw, nx, y0+88, name, font_bold(16), C_WHITE)
        text_center(draw, nx, y0+112, sub, font_sans(12), C_GRAY)

    # Arrows between nodes
    for i in range(len(nodes)-1):
        x1 = nodes[i][3] + 110
        x2 = nodes[i+1][3] - 110
        y = 320
        draw_arrow(draw, (x1, y), (x2, y), fill=C_ACCENT, width=3, head_size=14)

    # Bottom section - detailed steps
    draw.text((200, 460), "Call Establishment Steps", fill=C_ACCENT, font=font_bold(22))

    steps = [
        ("1. User clicks call button", "SIP.js creates WebRTC offer (SDP)"),
        ("2. ICE negotiation", "Browser discovers network path via STUN/TURN"),
        ("3. Janus receives WebRTC", "Converts to SIP INVITE message"),
        ("4. SIP trunk routing", "Forwarded to Vozelia Cloud PBX"),
        ("5. Agent phone rings", "Extension matched, call connected"),
        ("6. Media flows bidirectionally", "Audio via SRTP (encrypted)"),
        ("7. Call ends", "BYE signal, CDR recorded, transcription triggered"),
    ]

    sy = 505
    for step, detail in steps:
        draw.ellipse([210, sy+5, 220, sy+15], fill=C_ACCENT)
        draw.text((235, sy), step, fill=C_WHITE, font=font_bold(15))
        draw.text((600, sy), detail, fill=C_GRAY, font=font_sans(14))
        sy += 34

    # Features
    draw.text((200, 780), "Capabilities:", fill=C_WHITE, font=font_bold(18))
    caps = ["Echo cancellation", "Noise suppression", "DTMF support", "Call recording",
            "AI transcription", "Business hours check", "Queue management"]
    cx = 380
    for cap in caps:
        draw_rounded_rect(draw, [cx, 775, cx+len(cap)*9+20, 803], 8, fill="#1E293B")
        draw.text((cx+10, 780), cap, fill=C_ACCENT, font=font_sans(13))
        cx += len(cap)*9 + 30
        if cx > WIDTH - 200:
            cx = 380

    img.save(TEMP_DIR / "screenshot_24_voip_flow.png")
    print("  Created screenshot_24_voip_flow.png")


def create_plugins():
    """25 - Platform plugins"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_BG_DARK)
    draw = ImageDraw.Draw(img)

    draw.text((WIDTH//2 - 140, 40), "Platform Plugins", fill=C_WHITE, font=font_bold(32))
    draw.rectangle([WIDTH//2 - 140, 82, WIDTH//2 + 140, 84], fill=C_ACCENT)

    plugins = [
        ("WordPress", "PHP Plugin", "#21759B", "WP",
         ["Settings page in admin", "Shortcode [sarah-widget]", "Auto-inject via wp_footer",
          "WooCommerce compatible", "WPML translation ready"]),
        ("Shopify", "Liquid Template", "#96BF48", "SH",
         ["Theme App Extension", "Online Store 2.0 ready", "Cart event tracking",
          "Checkout integration", "Metafields support"]),
        ("Magento 2", "PHTML Module", "#EE672F", "M2",
         ["Admin configuration panel", "CMS block integration", "Customer session sync",
          "Multi-store support", "Composer installable"]),
    ]

    px = 130
    pw = (WIDTH - 280) // 3
    for name, tech, color, initials, features in plugins:
        x0 = px
        y0 = 130
        x1 = px + pw - 20
        y1 = 700
        draw_rounded_rect(draw, [x0, y0, x1, y1], 16, fill="#111827")
        draw.rectangle([x0, y0, x1, y0+8], fill=color)

        # Logo
        ccx = (x0+x1)//2
        draw.ellipse([ccx-45, y0+30, ccx+45, y0+120], fill=color)
        text_center(draw, ccx, y0+75, initials, font_bold(36), C_WHITE)

        text_center(draw, ccx, y0+145, name, font_bold(24), C_WHITE)
        text_center(draw, ccx, y0+175, tech, font_sans(14), C_GRAY)

        # Divider
        draw.line([x0+30, y0+200, x1-30, y0+200], fill="#334155", width=1)

        # Features
        fy = y0 + 220
        for feat in features:
            draw.ellipse([x0+30, fy+6, x0+40, fy+16], fill=C_ACCENT)
            draw.text((x0+50, fy), feat, fill=C_WHITE, font=font_sans(15))
            fy += 36

        # Install command
        draw.line([x0+30, fy+10, x1-30, fy+10], fill="#334155", width=1)
        draw.text((x0+30, fy+25), "Install:", fill=C_GRAY, font=font_bold(13))
        if name == "WordPress":
            cmd = "Upload rdgbot.php to /wp-content/plugins/"
        elif name == "Shopify":
            cmd = "Add rdgbot.liquid to theme snippets"
        else:
            cmd = "composer require redegal/sarah-magento2"
        draw.text((x0+30, fy+50), cmd, fill=C_ACCENT, font=font_mono(11))

        px += pw

    # Bottom note
    draw.text((WIDTH//2 - 250, 740), "All plugins include: auto-configuration, theme detection, and analytics tracking",
              fill=C_GRAY, font=font_sans(15))

    img.save(TEMP_DIR / "screenshot_25_plugins.png")
    print("  Created screenshot_25_plugins.png")


# ─────────────────────────────────────────────────
# Cover slides
# ─────────────────────────────────────────────────

def create_cover():
    """00 - Cover slide"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_BG_DARK)
    draw = ImageDraw.Draw(img)

    # Top accent bar
    draw.rectangle([0, 0, WIDTH, 6], fill=C_ACCENT)

    # Center content
    text_center(draw, WIDTH//2, 320, "Sarah", font_bold(96), C_WHITE)
    text_center(draw, WIDTH//2, 430, "Chatbot IA + VoIP", font_bold(40), hex_to_rgb(C_ACCENT))
    text_center(draw, WIDTH//2, 500, "Guia Completa", font_sans(28), hex_to_rgb(C_GRAY))

    # Decorative line
    draw.rectangle([WIDTH//2-100, 550, WIDTH//2+100, 553], fill=C_ACCENT)

    # Features row
    feats = ["4 idiomas", "Multi-AI", "WebRTC VoIP", "CRM Integration", "WordPress/Shopify/Magento"]
    fx = WIDTH//2 - 500
    for feat in feats:
        tw = draw.textlength(feat, font=font_sans(16))
        draw_rounded_rect(draw, [fx, 600, fx+int(tw)+30, 630], 14, fill="#111827", outline="#334155", width=1)
        draw.text((fx+15, 605), feat, fill=C_ACCENT, font=font_sans(16))
        fx += int(tw) + 50

    # Footer
    draw.rectangle([0, HEIGHT-60, WIDTH, HEIGHT], fill="#050810")
    text_center(draw, WIDTH//2, HEIGHT-35, "Redegal  |  Tecnologia & Marketing Digital  |  redegal.com", font_sans(14), hex_to_rgb(C_GRAY))

    img.save(TEMP_DIR / "screenshot_00_cover.png")
    print("  Created screenshot_00_cover.png")


def create_final():
    """26 - Final slide"""
    img = Image.new("RGB", (WIDTH, HEIGHT), C_BG_DARK)
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, WIDTH, 6], fill=C_ACCENT)

    text_center(draw, WIDTH//2, 300, "Gracias", font_bold(80), C_WHITE)

    # Contact info
    draw.rectangle([WIDTH//2-200, 400, WIDTH//2+200, 403], fill=C_ACCENT)

    contacts = [
        "jorge.vazquez@redegal.com",
        "redegal.com",
        "BME: RDG",
    ]
    cy = 440
    for c in contacts:
        text_center(draw, WIDTH//2, cy, c, font_sans(22), hex_to_rgb(C_GRAY))
        cy += 40

    # Offices
    text_center(draw, WIDTH//2, 580, "Ourense HQ  |  A Coruna  |  Madrid  |  Barcelona  |  CDMX",
                font_sans(16), hex_to_rgb(C_GRAY))

    # Accent circle decoration
    for i, (ox, oy) in enumerate([(200, 200), (1720, 200), (200, 880), (1720, 880)]):
        draw.ellipse([ox-30, oy-30, ox+30, oy+30], outline=C_ACCENT, width=2)

    # Footer
    draw.rectangle([0, HEIGHT-60, WIDTH, HEIGHT], fill="#050810")
    text_center(draw, WIDTH//2, HEIGHT-35, "Sarah v2.0  |  Chatbot IA + VoIP  |  Developed by Redegal",
                font_sans(14), hex_to_rgb(C_GRAY))

    img.save(TEMP_DIR / "screenshot_26_final.png")
    print("  Created screenshot_26_final.png")


# ─────────────────────────────────────────────────
# Phase 1: Playwright screenshots
# ─────────────────────────────────────────────────

def capture_playwright_screenshots():
    """Capture real screenshots using Playwright."""
    from playwright.sync_api import sync_playwright

    print("\n[Phase 1] Capturing Playwright screenshots...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
        )
        page = context.new_page()

        # ── Scene A: Widget test page (serves as demo site) ──
        print("  Navigating to widget test page...")
        page.goto(WIDGET_TEST_URL, wait_until="networkidle", timeout=15000)
        time.sleep(3)

        # 01 - Site with chatbot button visible
        page.screenshot(path=str(TEMP_DIR / "screenshot_01_site.png"), full_page=False)
        print("  Created screenshot_01_site.png")

        # 02 - Click chatbot button to open widget
        try:
            # Try to find and click the chat button in the shadow DOM or regular DOM
            # The widget typically has a floating button
            chat_btn = page.locator('[class*="chat-button"], [class*="widget-button"], [id*="sarah"], [class*="rdg-"], button[class*="float"]').first
            if chat_btn.is_visible(timeout=3000):
                chat_btn.click()
                time.sleep(2)
                page.screenshot(path=str(TEMP_DIR / "screenshot_02_widget_open.png"), full_page=False)
                print("  Created screenshot_02_widget_open.png (widget opened)")
            else:
                raise Exception("Chat button not found")
        except Exception as e:
            print(f"  Widget button not found ({e}), trying shadow DOM approach...")
            # Try clicking via JS for shadow DOM widgets
            try:
                page.evaluate("""
                    () => {
                        const hosts = document.querySelectorAll('[id*="sarah"], [id*="rdg"], [class*="sarah"], [class*="rdg"]');
                        for (const host of hosts) {
                            if (host.shadowRoot) {
                                const btn = host.shadowRoot.querySelector('button, [class*="button"], [class*="trigger"]');
                                if (btn) { btn.click(); return true; }
                            }
                        }
                        // Try all shadow roots
                        const allElements = document.querySelectorAll('*');
                        for (const el of allElements) {
                            if (el.shadowRoot) {
                                const btn = el.shadowRoot.querySelector('button');
                                if (btn) { btn.click(); return true; }
                            }
                        }
                        return false;
                    }
                """)
                time.sleep(2)
            except:
                pass
            page.screenshot(path=str(TEMP_DIR / "screenshot_02_widget_open.png"), full_page=False)
            print("  Created screenshot_02_widget_open.png (attempted click)")

        # 03 - Language selector
        try:
            # Try to find language selector in widget
            page.evaluate("""
                () => {
                    const allElements = document.querySelectorAll('*');
                    for (const el of allElements) {
                        if (el.shadowRoot) {
                            const langBtn = el.shadowRoot.querySelector('[class*="lang"], [data-lang], select[class*="lang"]');
                            if (langBtn) { langBtn.click(); return true; }
                        }
                    }
                    // Try regular DOM
                    const langEl = document.querySelector('[class*="lang"], select[class*="lang"]');
                    if (langEl) { langEl.click(); return true; }
                    return false;
                }
            """)
            time.sleep(1)
        except:
            pass
        page.screenshot(path=str(TEMP_DIR / "screenshot_03_language.png"), full_page=False)
        print("  Created screenshot_03_language.png")

        # 04 - Type a message
        try:
            page.evaluate("""
                () => {
                    const allElements = document.querySelectorAll('*');
                    for (const el of allElements) {
                        if (el.shadowRoot) {
                            const input = el.shadowRoot.querySelector('input[type="text"], textarea, [contenteditable]');
                            if (input) {
                                input.value = 'Hola, necesito informacion sobre vuestros servicios de SEO';
                                input.dispatchEvent(new Event('input', {bubbles: true}));
                                return true;
                            }
                        }
                    }
                    const input = document.querySelector('input[type="text"], textarea');
                    if (input) {
                        input.value = 'Hola, necesito informacion sobre vuestros servicios de SEO';
                        input.dispatchEvent(new Event('input', {bubbles: true}));
                        return true;
                    }
                    return false;
                }
            """)
            time.sleep(1)
        except:
            pass
        page.screenshot(path=str(TEMP_DIR / "screenshot_04_chat.png"), full_page=False)
        print("  Created screenshot_04_chat.png")

        # 05 - Dark mode
        try:
            page.evaluate("""
                () => {
                    const allElements = document.querySelectorAll('*');
                    for (const el of allElements) {
                        if (el.shadowRoot) {
                            const toggle = el.shadowRoot.querySelector('[class*="dark"], [class*="theme"], [class*="toggle"]');
                            if (toggle) { toggle.click(); return true; }
                        }
                    }
                    return false;
                }
            """)
            time.sleep(1)
        except:
            pass
        page.screenshot(path=str(TEMP_DIR / "screenshot_05_dark.png"), full_page=False)
        print("  Created screenshot_05_dark.png")

        # ── Scene B: Real application ──
        print("  Navigating to health endpoint...")
        page.goto(HEALTH_URL, wait_until="networkidle", timeout=10000)
        time.sleep(1)
        page.screenshot(path=str(TEMP_DIR / "screenshot_06_health.png"), full_page=False)
        print("  Created screenshot_06_health.png")

        print("  Navigating to widget test page...")
        page.goto(WIDGET_TEST_URL, wait_until="networkidle", timeout=10000)
        time.sleep(3)
        page.screenshot(path=str(TEMP_DIR / "screenshot_07_widget_test.png"), full_page=False)
        print("  Created screenshot_07_widget_test.png")

        print("  Navigating to dashboard...")
        page.goto(DASHBOARD_URL, wait_until="networkidle", timeout=10000)
        time.sleep(2)
        page.screenshot(path=str(TEMP_DIR / "screenshot_08_dashboard_login.png"), full_page=False)
        print("  Created screenshot_08_dashboard_login.png")

        browser.close()
    print("  Playwright screenshots complete.")


# ─────────────────────────────────────────────────
# Phase 2: Generate TTS narration
# ─────────────────────────────────────────────────

async def generate_narrations():
    """Generate MP3 narration for each scene."""
    import edge_tts

    print("\n[Phase 2] Generating narrations with edge-tts...")
    for key, text in NARRATIONS.items():
        out_path = TEMP_DIR / f"narration_{key}.mp3"
        communicate = edge_tts.Communicate(text, TTS_VOICE)
        await communicate.save(str(out_path))
        print(f"  Generated narration_{key}.mp3")
    print("  All narrations generated.")


# ─────────────────────────────────────────────────
# Phase 3: Compile video
# ─────────────────────────────────────────────────

def get_audio_duration(path):
    """Get audio duration in seconds using ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 5.0  # fallback


def compile_video():
    """Compile all screenshots + narrations into final video."""
    print("\n[Phase 3] Compiling video...")

    # Scene order
    scene_order = [f"{i:02d}" for i in range(27)]

    # Map scene numbers to screenshot filenames
    screenshot_names = {
        "00": "screenshot_00_cover.png",
        "01": "screenshot_01_site.png",
        "02": "screenshot_02_widget_open.png",
        "03": "screenshot_03_language.png",
        "04": "screenshot_04_chat.png",
        "05": "screenshot_05_dark.png",
        "06": "screenshot_06_health.png",
        "07": "screenshot_07_widget_test.png",
        "08": "screenshot_08_dashboard_login.png",
        "09": "screenshot_09_terminal_clone.png",
        "10": "screenshot_10_terminal_setup.png",
        "11": "screenshot_11_terminal_docker.png",
        "12": "screenshot_12_terminal_health.png",
        "13": "screenshot_13_dashboard_queue.png",
        "14": "screenshot_14_dashboard_chat.png",
        "15": "screenshot_15_dashboard_leads.png",
        "16": "screenshot_16_dashboard_analytics.png",
        "17": "screenshot_17_dashboard_calls.png",
        "18": "screenshot_18_dashboard_training.png",
        "19": "screenshot_19_wallboard.png",
        "20": "screenshot_20_architecture.png",
        "21": "screenshot_21_config.png",
        "22": "screenshot_22_ai_providers.png",
        "23": "screenshot_23_crm.png",
        "24": "screenshot_24_voip_flow.png",
        "25": "screenshot_25_plugins.png",
        "26": "screenshot_26_final.png",
    }

    clips = []
    for scene_num in scene_order:
        img_path = TEMP_DIR / screenshot_names[scene_num]
        audio_path = TEMP_DIR / f"narration_{scene_num}.mp3"
        clip_path = TEMP_DIR / f"clip_{scene_num}.mp4"

        if not img_path.exists():
            print(f"  WARNING: {img_path.name} not found, skipping...")
            continue
        if not audio_path.exists():
            print(f"  WARNING: {audio_path.name} not found, skipping...")
            continue

        duration = get_audio_duration(audio_path)
        # Add 1 second of padding after narration
        total_duration = duration + 1.0

        print(f"  Encoding clip_{scene_num}.mp4 (image + {duration:.1f}s audio)...")

        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(img_path),
            "-i", str(audio_path),
            "-c:v", "libx264", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-t", str(total_duration),
            "-vf", f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:black",
            "-shortest",
            str(clip_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"    ERROR: {result.stderr[-200:]}")
            continue
        clips.append(clip_path)

    if not clips:
        print("  ERROR: No clips generated!")
        return False

    # Create concat file
    concat_path = TEMP_DIR / "concat.txt"
    with open(concat_path, "w") as f:
        for clip in clips:
            f.write(f"file '{clip}'\n")

    # Concatenate all clips
    print(f"  Concatenating {len(clips)} clips...")
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_path),
        "-c", "copy",
        str(OUTPUT_VIDEO)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  Concat ERROR: {result.stderr[-300:]}")
        # Try re-encoding
        print("  Retrying with re-encoding...")
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_path),
            "-c:v", "libx264", "-c:a", "aac",
            "-pix_fmt", "yuv420p",
            str(OUTPUT_VIDEO)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"  Re-encode ERROR: {result.stderr[-300:]}")
            return False

    # Get final video info
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration,size",
         "-of", "json", str(OUTPUT_VIDEO)],
        capture_output=True, text=True
    )
    try:
        info = json.loads(result.stdout)
        duration = float(info["format"]["duration"])
        size_mb = int(info["format"]["size"]) / (1024*1024)
        print(f"\n  Video created: {OUTPUT_VIDEO}")
        print(f"  Duration: {duration:.1f}s ({duration/60:.1f} min)")
        print(f"  Size: {size_mb:.1f} MB")
    except:
        print(f"\n  Video created: {OUTPUT_VIDEO}")

    return True


# ─────────────────────────────────────────────────
# Phase 4: Send email
# ─────────────────────────────────────────────────

def send_email():
    """Send the video via email."""
    print("\n[Phase 4] Sending email...")

    smtp_host = "smtp.gmail.com"
    smtp_port = 587
    smtp_user = "jorge.vazquez@redegal.com"
    smtp_pass = "fnhn lruh jsiw xvua"
    to_addr = "jorge.vazquez@redegal.com"
    subject = "Sarah — Screencast Demo Real (Video)"

    file_size_mb = OUTPUT_VIDEO.stat().st_size / (1024*1024) if OUTPUT_VIDEO.exists() else 0

    msg = MIMEMultipart()
    msg["From"] = smtp_user
    msg["To"] = to_addr
    msg["Subject"] = subject

    if file_size_mb > 25:
        body = f"""Hola Jorge,

El screencast de Sarah ha sido generado exitosamente.

El archivo es demasiado grande para adjuntarlo por email ({file_size_mb:.1f} MB).
Lo puedes encontrar en:

{OUTPUT_VIDEO}

Duracion: ver ffprobe para detalles.

Saludos,
Sarah Screencast Generator
"""
        msg.attach(MIMEText(body, "plain", "utf-8"))
    else:
        body = f"""Hola Jorge,

Adjunto el screencast de Sarah ({file_size_mb:.1f} MB).

Este video incluye:
- Demo real del widget funcionando en localhost:9456
- Capturas del dashboard, health endpoint y widget test
- Mockups del dashboard completo (queue, chat, leads, analytics, calls, training, wallboard)
- Diagramas de arquitectura, configuracion, AI providers, CRM, VoIP y plugins
- Narrado profesionalmente en espanol

Archivo local: {OUTPUT_VIDEO}

Saludos,
Sarah Screencast Generator
"""
        msg.attach(MIMEText(body, "plain", "utf-8"))

        if OUTPUT_VIDEO.exists():
            with open(OUTPUT_VIDEO, "rb") as f:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f"attachment; filename=Sarah-Screencast.mp4")
                msg.attach(part)

    try:
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to_addr, msg.as_string())
        server.quit()
        print(f"  Email sent to {to_addr}")
        return True
    except Exception as e:
        print(f"  Email failed: {e}")
        return False


# ─────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Sarah Screencast Video Generator")
    print("=" * 60)

    # Ensure temp dir exists
    TEMP_DIR.mkdir(parents=True, exist_ok=True)

    # Phase 1A: Playwright real screenshots
    try:
        capture_playwright_screenshots()
    except Exception as e:
        print(f"  Playwright error: {e}")
        print("  Continuing with synthetic screenshots...")

    # Phase 1B: Pillow-drawn screenshots (terminal)
    create_terminal_screenshots()

    # Phase 1C: Dashboard mockups
    print("\n[Scene D] Creating dashboard mockups...")
    create_dashboard_queue()
    create_dashboard_chat()
    create_dashboard_leads()
    create_dashboard_analytics()
    create_dashboard_calls()
    create_dashboard_training()
    create_wallboard()

    # Phase 1D: Architecture/config slides
    print("\n[Scene E] Creating architecture/config slides...")
    create_architecture()
    create_config()
    create_ai_providers()
    create_crm()
    create_voip_flow()
    create_plugins()

    # Phase 1E: Cover slides
    print("\n[Cover] Creating cover and final slides...")
    create_cover()
    create_final()

    # Phase 2: Generate narrations
    asyncio.run(generate_narrations())

    # Phase 3: Compile video
    success = compile_video()

    # Phase 4: Send email
    if success and OUTPUT_VIDEO.exists():
        send_email()
    else:
        print("\n  Skipping email - video was not created successfully.")

    print("\n" + "=" * 60)
    print("  DONE")
    print("=" * 60)


if __name__ == "__main__":
    main()
