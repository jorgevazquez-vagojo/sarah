#!/usr/bin/env python3
"""
Redegal Chatbot — Demo Video Generator v3
Real website screenshots + simulated chatbot widget overlay + Edge TTS voices.

Captures actual pages from localhost:3847 (NewRedegalWeb),
draws a realistic chatbot widget on top, and generates MP4 with voiceover.
"""

import subprocess
import os
import sys
import time
import textwrap
import math

# ─── Paths ───
BASEDIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOTS_DIR = os.path.join(BASEDIR, "screenshots")
AUDIO_DIR = os.path.join(BASEDIR, "audio3")
SLIDES_DIR = os.path.join(BASEDIR, "slides3")
OUTPUT = os.path.expanduser("~/Downloads/redegal-chatbot-demo.mp4")

for d in (SCREENSHOTS_DIR, AUDIO_DIR, SLIDES_DIR):
    os.makedirs(d, exist_ok=True)

# ─── Colors ───
PRIMARY = "#00d4aa"
ACCENT = "#6c5ce7"
BLUE = "#3b82f6"
PINK = "#ec4899"
AMBER = "#f59e0b"
GREEN = "#10b981"
DARK_BG = "#1e1e2e"
WIDGET_BG = "#ffffff"
WIDGET_HEADER = "#0c0f1a"
CHAT_BG = "#f8fafc"
MSG_USER = "#e0f2fe"
MSG_BOT = "#f0fdf4"
MSG_AGENT_BG = "#eff6ff"

# ─── TTS Voices ───
VOICES = {
    "narrator": ("es-MX-JorgeNeural", "-5%", "+0Hz"),
    "agent":    ("es-ES-AlvaroNeural", "+0%", "+3Hz"),
    "lead":     ("es-ES-ElviraNeural", "+0%", "+0Hz"),
}

# ─── Web pages to screenshot ───
PAGES = {
    "home":      "http://localhost:3847/",
    "solutions": "http://localhost:3847/solutions",
    "about":     "http://localhost:3847/about",
    "cases":     "http://localhost:3847/cases",
    "contact":   "http://localhost:3847/contact",
    "investors": "http://localhost:3847/investors",
}


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def hex_to_rgba(h, a=255):
    return (*hex_to_rgb(h), a)


def capture_screenshots():
    """Capture real website screenshots using Selenium."""
    print("\n📸 Capturing website screenshots...")
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--force-device-scale-factor=1")
    driver = webdriver.Chrome(options=opts)

    screenshots = {}
    for name, url in PAGES.items():
        driver.get(url)
        time.sleep(1.5)  # Let page render
        path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
        driver.save_screenshot(path)
        screenshots[name] = path
        sz = os.path.getsize(path) // 1024
        print(f"  ✓ {name}: {url} ({sz}KB)")

    driver.quit()
    return screenshots


def load_font(size, bold=False):
    from PIL import ImageFont
    paths = [
        "/Library/Fonts/SF-Pro-Display-Bold.otf" if bold else "/Library/Fonts/SF-Pro-Display-Regular.otf",
        "/Library/Fonts/SF-Pro-Text-Bold.otf" if bold else "/Library/Fonts/SF-Pro-Text-Regular.otf",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    """Draw a rounded rectangle with proper corners."""
    x1, y1, x2, y2 = xy
    r = radius
    # Use Pillow's built-in rounded_rectangle
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def draw_widget_frame(img, draw, state="open", title="Redegal Chat"):
    """Draw the widget frame (header + body area) on the right side of the screen."""
    from PIL import Image, ImageDraw

    W, H = img.size
    # Widget dimensions
    ww, wh = 400, 600
    margin = 24
    wx = W - ww - margin
    wy = H - wh - margin - 60  # Above the fab button

    if state == "bubble":
        # Just the floating action button
        fab_x = W - 80 - margin
        fab_y = H - 80 - margin
        draw.ellipse([fab_x, fab_y, fab_x + 64, fab_y + 64],
                     fill=hex_to_rgb(PRIMARY))
        # Chat icon (simple lines)
        cx, cy = fab_x + 32, fab_y + 32
        draw.rounded_rectangle([cx-14, cy-10, cx+14, cy-2], radius=4,
                               fill=(255, 255, 255))
        draw.rounded_rectangle([cx-10, cy+2, cx+10, cy+8], radius=3,
                               fill=(255, 255, 255))
        return None  # No widget area

    # Shadow effect
    for i in range(8):
        alpha_color = (0, 0, 0)
        shadow_rect = [wx - i, wy - i, wx + ww + i, wy + wh + i]
        draw.rounded_rectangle(shadow_rect, radius=18 + i,
                               fill=None, outline=(*alpha_color, 12 - i), width=1)

    # Widget body background
    draw.rounded_rectangle([wx, wy, wx + ww, wy + wh], radius=16,
                           fill=(255, 255, 255))

    # Header bar
    header_h = 64
    draw.rounded_rectangle([wx, wy, wx + ww, wy + header_h + 8], radius=16,
                           fill=hex_to_rgb(WIDGET_HEADER))
    # Cover bottom corners of header
    draw.rectangle([wx, wy + header_h - 8, wx + ww, wy + header_h + 8],
                   fill=hex_to_rgb(WIDGET_HEADER))

    # Header content
    font_header = load_font(18, bold=True)
    font_sub = load_font(12)
    draw.text((wx + 56, wy + 14), title, fill=(255, 255, 255), font=font_header)
    draw.text((wx + 56, wy + 36), "En línea · Responde al instante",
              fill=(148, 163, 184), font=font_sub)

    # Avatar circle
    draw.ellipse([wx + 14, wy + 14, wx + 46, wy + 46],
                 fill=hex_to_rgb(PRIMARY))
    font_avatar = load_font(16, bold=True)
    draw.text((wx + 22, wy + 20), "RC", fill=(255, 255, 255), font=font_avatar)

    # Close button
    draw.text((wx + ww - 32, wy + 20), "✕", fill=(148, 163, 184), font=font_sub)

    # Body area coordinates
    body_y = wy + header_h + 8
    body_h = wh - header_h - 8

    return (wx, body_y, ww, body_h)


def draw_chat_messages(draw, body, messages):
    """Draw chat message bubbles in the widget body area.
    messages: list of (sender, text) where sender is 'user', 'bot', or 'agent'
    """
    wx, body_y, ww, body_h = body
    font_msg = load_font(14)
    font_name = load_font(11, bold=True)
    y = body_y + 12
    pad = 12

    for sender, text in messages:
        if y > body_y + body_h - 40:
            break

        lines = textwrap.wrap(text, width=38)
        bubble_h = len(lines) * 20 + 16
        name_h = 16

        if sender == "user":
            # Right-aligned blue bubble
            bw = min(ww - 60, max(len(l) for l in lines) * 8 + 24) if lines else 100
            bx = wx + ww - bw - pad
            draw.rounded_rectangle([bx, y, bx + bw, y + bubble_h],
                                   radius=12, fill=hex_to_rgb("#dbeafe"))
            ty = y + 8
            for line in lines:
                draw.text((bx + 12, ty), line, fill=(30, 58, 138), font=font_msg)
                ty += 20

        elif sender == "bot":
            # Left-aligned green bubble with bot label
            draw.text((wx + pad, y), "🤖 Redegal Bot", fill=(100, 116, 139), font=font_name)
            y += name_h
            bw = min(ww - 60, max(len(l) for l in lines) * 8 + 24) if lines else 100
            bx = wx + pad
            draw.rounded_rectangle([bx, y, bx + bw, y + bubble_h],
                                   radius=12, fill=hex_to_rgb("#f0fdf4"))
            ty = y + 8
            for line in lines:
                draw.text((bx + 12, ty), line, fill=(20, 83, 45), font=font_msg)
                ty += 20

        elif sender == "agent":
            # Left-aligned blue bubble with agent label
            draw.text((wx + pad, y), "👤 David — Agente Boostic",
                      fill=(100, 116, 139), font=font_name)
            y += name_h
            bw = min(ww - 60, max(len(l) for l in lines) * 8 + 24) if lines else 100
            bx = wx + pad
            draw.rounded_rectangle([bx, y, bx + bw, y + bubble_h],
                                   radius=12, fill=hex_to_rgb("#eff6ff"))
            ty = y + 8
            for line in lines:
                draw.text((bx + 12, ty), line, fill=(30, 58, 138), font=font_msg)
                ty += 20

        y += bubble_h + 10

    # Input bar at bottom
    input_y = body_y + body_h - 48
    draw.rounded_rectangle([wx + 8, input_y, wx + ww - 8, input_y + 40],
                           radius=20, fill=(241, 245, 249), outline=(203, 213, 225))
    font_placeholder = load_font(13)
    draw.text((wx + 24, input_y + 12), "Escribe un mensaje...",
              fill=(148, 163, 184), font=font_placeholder)
    # Send button
    draw.ellipse([wx + ww - 44, input_y + 6, wx + ww - 16, input_y + 34],
                 fill=hex_to_rgb(PRIMARY))
    draw.text((wx + ww - 38, input_y + 10), "➤", fill=(255, 255, 255), font=font_msg)


def draw_call_chooser(draw, body):
    """Draw the call mode chooser (WebRTC vs Callback)."""
    wx, body_y, ww, body_h = body
    font_title = load_font(16, bold=True)
    font_desc = load_font(13)
    font_btn = load_font(15, bold=True)

    cy = body_y + 30
    draw.text((wx + ww // 2 - 80, cy), "¿Cómo quieres llamar?",
              fill=(30, 41, 59), font=font_title)
    cy += 40

    # WebRTC button
    btn_h = 80
    draw.rounded_rectangle([wx + 20, cy, wx + ww - 20, cy + btn_h],
                           radius=12, fill=hex_to_rgb(PRIMARY))
    draw.text((wx + 50, cy + 14), "🖥  Llamar desde el",
              fill=(255, 255, 255), font=font_btn)
    draw.text((wx + 50, cy + 36), "     navegador",
              fill=(255, 255, 255), font=font_btn)
    draw.text((wx + 50, cy + 58), "WebRTC · Sin teléfono",
              fill=(200, 255, 240), font=font_desc)
    cy += btn_h + 16

    # Callback button
    draw.rounded_rectangle([wx + 20, cy, wx + ww - 20, cy + btn_h],
                           radius=12, fill=None,
                           outline=hex_to_rgb(AMBER), width=2)
    draw.text((wx + 50, cy + 14), "📞  Que me llamen al",
              fill=(30, 41, 59), font=font_btn)
    draw.text((wx + 50, cy + 36), "     teléfono",
              fill=(30, 41, 59), font=font_btn)
    draw.text((wx + 50, cy + 58), "Click2Call · Callback SIP",
              fill=(100, 116, 139), font=font_desc)
    cy += btn_h + 30

    # Info text
    draw.text((wx + 20, cy), "Ambas opciones incluyen grabación",
              fill=(148, 163, 184), font=font_desc)
    draw.text((wx + 20, cy + 18), "y transcripción con IA.",
              fill=(148, 163, 184), font=font_desc)


def draw_preflight(draw, body, checks=3):
    """Draw preflight check screen."""
    wx, body_y, ww, body_h = body
    font_title = load_font(16, bold=True)
    font_check = load_font(14)
    font_status = load_font(13, bold=True)

    cy = body_y + 40
    draw.text((wx + ww // 2 - 80, cy), "Verificación del sistema",
              fill=(30, 41, 59), font=font_title)
    cy += 50

    items = [
        ("🎤", "Micrófono", "Permitido"),
        ("🌐", "Conexión de red", "Estable (42ms)"),
        ("🖥", "Servidor Janus", "Conectado"),
    ]
    for i, (icon, label, status) in enumerate(items):
        active = i < checks
        color = hex_to_rgb(GREEN) if active else (203, 213, 225)
        check = "✓" if active else "○"

        draw.rounded_rectangle([wx + 20, cy, wx + ww - 20, cy + 52],
                               radius=10, fill=(248, 250, 252) if active else (255, 255, 255),
                               outline=color if active else (226, 232, 240), width=1)

        draw.text((wx + 36, cy + 14), f"{icon}  {label}",
                  fill=(30, 41, 59), font=font_check)
        draw.text((wx + ww - 120, cy + 8), check,
                  fill=color, font=load_font(20, bold=True))
        if active:
            draw.text((wx + ww - 140, cy + 30), status,
                      fill=hex_to_rgb(GREEN), font=load_font(11))
        cy += 62

    if checks >= 3:
        cy += 20
        draw.rounded_rectangle([wx + 40, cy, wx + ww - 40, cy + 44],
                               radius=22, fill=hex_to_rgb(PRIMARY))
        draw.text((wx + ww // 2 - 50, cy + 12), "Iniciar llamada",
                  fill=(255, 255, 255), font=font_title)


def draw_calling_screen(draw, body, status="calling", mode="webrtc", duration=None):
    """Draw the calling/connected screen."""
    wx, body_y, ww, body_h = body
    font_title = load_font(18, bold=True)
    font_sub = load_font(14)
    font_dur = load_font(28, bold=True)
    font_small = load_font(12)
    font_btn = load_font(13, bold=True)

    cy = body_y + 40

    # Mode indicator
    mode_label = "WebRTC" if mode == "webrtc" else "Callback"
    mode_color = hex_to_rgb(BLUE) if mode == "webrtc" else hex_to_rgb(AMBER)
    pill_w = len(mode_label) * 9 + 20
    draw.rounded_rectangle([wx + ww // 2 - pill_w // 2, cy,
                            wx + ww // 2 + pill_w // 2, cy + 26],
                           radius=13, fill=mode_color)
    draw.text((wx + ww // 2 - pill_w // 2 + 10, cy + 5), mode_label,
              fill=(255, 255, 255), font=font_small)
    cy += 40

    # Avatar
    avatar_r = 40
    cx = wx + ww // 2
    av_color = hex_to_rgb(GREEN) if status == "connected" else hex_to_rgb(BLUE)
    draw.ellipse([cx - avatar_r, cy, cx + avatar_r, cy + avatar_r * 2],
                 fill=av_color)
    draw.text((cx - 14, cy + 22), "DV", fill=(255, 255, 255), font=font_title)
    cy += avatar_r * 2 + 16

    # Name
    draw.text((cx - 60, cy), "David Vázquez",
              fill=(30, 41, 59), font=font_title)
    cy += 24
    draw.text((cx - 50, cy), "Agente Boostic",
              fill=(100, 116, 139), font=font_sub)
    cy += 36

    if status == "calling":
        # Pulsing dots
        draw.text((cx - 40, cy), "Llamando...",
                  fill=(100, 116, 139), font=font_sub)
        # Ring animation circles
        for i in range(3):
            r = 60 + i * 20
            draw.ellipse([cx - r, body_y + 60 - r + 40, cx + r, body_y + 60 + r + 40],
                         outline=(*av_color, max(40 - i * 15, 10)), width=1)

    elif status == "connected":
        if duration:
            draw.text((cx - 35, cy), duration,
                      fill=(30, 41, 59), font=font_dur)
            cy += 40
        # Quality indicator
        draw.text((cx - 50, cy), "Calidad: MOS 4.2",
                  fill=hex_to_rgb(GREEN), font=font_small)
        cy += 16
        draw.text((cx - 60, cy), "🔒 Cifrado · Grabando",
                  fill=(148, 163, 184), font=font_small)

    elif status == "ended":
        draw.text((cx - 50, cy), "Llamada finalizada",
                  fill=(100, 116, 139), font=font_sub)
        cy += 30
        if duration:
            draw.text((cx - 35, cy), duration,
                      fill=(30, 41, 59), font=font_dur)
            cy += 40
        draw.text((cx - 70, cy), "✓ Grabación guardada",
                  fill=hex_to_rgb(GREEN), font=font_sub)
        cy += 20
        draw.text((cx - 70, cy), "✓ Transcripción IA lista",
                  fill=hex_to_rgb(GREEN), font=font_sub)

    # Bottom controls
    ctrl_y = body_y + body_h - 70
    if status == "connected":
        # Mute button
        draw.ellipse([cx - 70, ctrl_y, cx - 30, ctrl_y + 40],
                     fill=(241, 245, 249))
        draw.text((cx - 58, ctrl_y + 10), "🎤", font=font_sub)
        # Hangup button
        draw.ellipse([cx - 20, ctrl_y, cx + 20, ctrl_y + 40],
                     fill=(239, 68, 68))
        draw.text((cx - 8, ctrl_y + 10), "📞", font=font_sub)
        # Speaker button
        draw.ellipse([cx + 30, ctrl_y, cx + 70, ctrl_y + 40],
                     fill=(241, 245, 249))
        draw.text((cx + 42, ctrl_y + 10), "🔊", font=font_sub)
    elif status == "calling":
        draw.ellipse([cx - 20, ctrl_y, cx + 20, ctrl_y + 40],
                     fill=(239, 68, 68))
        draw.text((cx - 8, ctrl_y + 10), "📞", font=font_sub)


def draw_phone_input(draw, body, phone="+34 612 345 678"):
    """Draw phone number input for callback mode."""
    wx, body_y, ww, body_h = body
    font_title = load_font(16, bold=True)
    font_sub = load_font(13)
    font_input = load_font(18)
    font_btn = load_font(15, bold=True)

    cy = body_y + 40
    draw.text((wx + ww // 2 - 70, cy), "Que me llamen",
              fill=(30, 41, 59), font=font_title)
    cy += 30
    draw.text((wx + 24, cy), "Introduce tu número y te llamamos",
              fill=(100, 116, 139), font=font_sub)
    draw.text((wx + 24, cy + 18), "en menos de 10 segundos.",
              fill=(100, 116, 139), font=font_sub)
    cy += 60

    # Phone input field
    draw.rounded_rectangle([wx + 20, cy, wx + ww - 20, cy + 50],
                           radius=10, fill=(255, 255, 255),
                           outline=hex_to_rgb(PRIMARY), width=2)
    draw.text((wx + 36, cy + 13), f"📱  {phone}",
              fill=(30, 41, 59), font=font_input)
    cy += 70

    # Call button
    draw.rounded_rectangle([wx + 20, cy, wx + ww - 20, cy + 48],
                           radius=24, fill=hex_to_rgb(AMBER))
    draw.text((wx + ww // 2 - 50, cy + 13), "📞  Llamadme",
              fill=(255, 255, 255), font=font_btn)
    cy += 70

    # Back link
    draw.text((wx + ww // 2 - 30, cy), "← Volver",
              fill=hex_to_rgb(BLUE), font=font_sub)


def draw_dashboard_overlay(img, draw):
    """Draw a dashboard-like overlay on the full image (not just widget)."""
    from PIL import Image
    W, H = img.size
    font_title = load_font(20, bold=True)
    font_sub = load_font(14)
    font_val = load_font(28, bold=True)
    font_small = load_font(12)
    font_label = load_font(11)

    # Semi-transparent dark overlay
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    from PIL import ImageDraw as ID
    odraw = ID.Draw(overlay)
    odraw.rectangle([0, 0, W, H], fill=(12, 15, 26, 210))
    img.paste(Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB"))
    draw = type(draw)(img)  # Recreate draw object

    # Dashboard header
    draw.rounded_rectangle([60, 30, W - 60, 80], radius=12,
                           fill=hex_to_rgb(WIDGET_HEADER))
    draw.text((80, 42), "📊  Redegal Chatbot — Dashboard de Agentes",
              fill=(255, 255, 255), font=font_title)
    draw.text((W - 300, 48), "David Vázquez · Boostic",
              fill=(148, 163, 184), font=font_sub)

    # Stat cards row
    stats = [
        ("Conversaciones", "127", "+12%", GREEN),
        ("Llamadas Hoy", "23", "8 WebRTC · 15 Callback", BLUE),
        ("Leads Activos", "14", "3 hot · 7 warm", AMBER),
        ("MOS Promedio", "4.1", "Calidad excelente", GREEN),
    ]
    card_w = (W - 160) // 4
    for i, (label, value, detail, color) in enumerate(stats):
        cx = 80 + i * (card_w + 12)
        draw.rounded_rectangle([cx, 100, cx + card_w, 210],
                               radius=12, fill=(30, 34, 54))
        draw.text((cx + 16, 115), label, fill=(148, 163, 184), font=font_small)
        draw.text((cx + 16, 138), value, fill=hex_to_rgb(color), font=font_val)
        draw.text((cx + 16, 178), detail, fill=(100, 116, 139), font=font_label)

    # Recent calls table
    draw.rounded_rectangle([60, 230, W - 60, 700], radius=12,
                           fill=(30, 34, 54))
    draw.text((80, 248), "Llamadas Recientes", fill=(255, 255, 255), font=font_title)

    # Table header
    headers = ["Estado", "Tipo", "Lead", "Duración", "Agente", "Grabación", "Calidad"]
    hx = [90, 200, 320, 560, 700, 870, 1050]
    for j, h in enumerate(headers):
        draw.text((hx[j], 288), h, fill=(148, 163, 184), font=font_small)

    # Separator
    draw.line([80, 310, W - 80, 310], fill=(55, 65, 81), width=1)

    # Table rows
    rows = [
        ("🟢", "WebRTC", "María García · moda-demo.com", "03:47", "David V.", "✓ Grabada", "MOS 4.2"),
        ("🟢", "Callback", "Carlos López · retail.es", "05:12", "David V.", "✓ Grabada", "MOS 4.0"),
        ("🟡", "WebRTC", "Ana Martínez · tech.io", "01:23", "Claudia R.", "✓ Grabada", "MOS 3.8"),
        ("🔴", "Callback", "Pedro Ruiz · shop.es", "00:00", "Sin asignar", "—", "—"),
        ("🟢", "WebRTC", "Laura Sanz · moda.es", "04:56", "David V.", "✓ Grabada", "MOS 4.3"),
        ("🟢", "Callback", "Javier Gil · retail-pro.com", "02:34", "Claudia R.", "✓ Grabada", "MOS 4.1"),
        ("🟢", "WebRTC", "Elena Ruiz · digital.es", "06:11", "David V.", "✓ Grabada", "MOS 4.4"),
        ("🟡", "Callback", "Miguel Torres · ecom.net", "03:02", "David V.", "✓ Grabada", "MOS 3.9"),
    ]
    for i, row in enumerate(rows):
        ry = 325 + i * 44
        if ry > 680:
            break
        # Alternating row bg
        if i % 2 == 0:
            draw.rounded_rectangle([70, ry - 5, W - 70, ry + 35], radius=6,
                                   fill=(36, 40, 62))
        for j, cell in enumerate(row):
            color = (226, 232, 240)
            if j == 1:
                color = hex_to_rgb(BLUE) if cell == "WebRTC" else hex_to_rgb(AMBER)
            elif j == 5 and "✓" in cell:
                color = hex_to_rgb(GREEN)
            draw.text((hx[j], ry + 5), cell, fill=color, font=font_small)

    # Bottom: AI learning indicator
    draw.rounded_rectangle([60, 720, W // 2 - 10, 870], radius=12,
                           fill=(30, 34, 54))
    draw.text((80, 740), "🧠 IA Aprendizaje", fill=(255, 255, 255), font=font_title)
    draw.text((80, 775), "Transcripciones procesadas hoy: 23",
              fill=(148, 163, 184), font=font_sub)
    draw.text((80, 800), "Knowledge base actualizado: hace 12 min",
              fill=(148, 163, 184), font=font_sub)
    draw.text((80, 825), "CSAT promedio: 4.6/5.0 ⭐",
              fill=hex_to_rgb(GREEN), font=font_sub)

    # Lead notifications panel
    draw.rounded_rectangle([W // 2 + 10, 720, W - 60, 870], radius=12,
                           fill=(30, 34, 54))
    draw.text((W // 2 + 30, 740), "🔔 Notificaciones de Leads",
              fill=(255, 255, 255), font=font_title)
    notifs = [
        ("🔴 HOT", "María García pidió propuesta SEO — hace 2 min"),
        ("🟡 WARM", "Carlos López interesado en Ads — hace 15 min"),
        ("🟢 NEW", "Laura Sanz preguntó por precios — hace 1h"),
    ]
    ny = 775
    for badge, text in notifs:
        draw.text((W // 2 + 30, ny), badge, fill=hex_to_rgb(AMBER), font=font_small)
        draw.text((W // 2 + 100, ny), text, fill=(148, 163, 184), font=font_small)
        ny += 28

    # Footer
    draw.text((W // 2 - 180, H - 40),
              "Redegal Chatbot Dashboard · WebRTC + Click2Call · Powered by Redegal Digital Tech",
              fill=(71, 85, 105), font=font_label)

    return draw


def draw_sip_flow(draw, body, step="invite"):
    """Draw SIP signaling flow for callback."""
    wx, body_y, ww, body_h = body
    font_title = load_font(15, bold=True)
    font_sub = load_font(12)
    font_small = load_font(11)

    cy = body_y + 20
    draw.text((wx + ww // 2 - 60, cy), "Callback SIP",
              fill=(30, 41, 59), font=font_title)
    cy += 35

    # Flow diagram
    steps = [
        ("Server", "→ SIP INVITE →", "Vozelia PBX"),
        ("Vozelia", "→ Llamada →", "Tu teléfono"),
        ("Tú contestas", "→ SIP REFER →", "Agente"),
        ("", "Conectados", ""),
    ]

    active_step = {"invite": 0, "ringing": 1, "answer": 2, "connected": 3}[step]

    for i, (left, middle, right) in enumerate(steps):
        is_active = i <= active_step
        is_current = i == active_step
        color = hex_to_rgb(GREEN) if is_active else (203, 213, 225)
        bg = hex_to_rgb("#f0fdf4") if is_current else (248, 250, 252)

        draw.rounded_rectangle([wx + 12, cy, wx + ww - 12, cy + 44],
                               radius=8, fill=bg,
                               outline=color if is_current else (226, 232, 240))

        if left:
            draw.text((wx + 20, cy + 6), left, fill=color, font=font_sub)
        draw.text((wx + ww // 2 - 40, cy + 14), middle,
                  fill=color if is_active else (203, 213, 225), font=font_small)
        if right:
            bbox = draw.textbbox((0, 0), right, font=font_sub)
            rw = bbox[2] - bbox[0]
            draw.text((wx + ww - 20 - rw, cy + 6), right, fill=color, font=font_sub)

        # Check mark
        if is_active and i < active_step:
            draw.text((wx + ww - 30, cy + 14), "✓",
                      fill=hex_to_rgb(GREEN), font=font_title)
        elif is_current:
            draw.text((wx + ww - 30, cy + 14), "●",
                      fill=hex_to_rgb(GREEN), font=font_sub)

        cy += 54

    if step == "connected":
        cy += 10
        draw.text((wx + ww // 2 - 50, cy), "🟢 Conectado",
                  fill=hex_to_rgb(GREEN), font=font_title)


# ─── Scene definitions ───
# (speaker, text, page, widget_state, widget_draw_func_name, extra_args)

SCENES = [
    # ACT 1: Intro
    ("narrator",
     "Bienvenidos a la demostración del chatbot inteligente de Redegal, sobre la web real de la compañía.",
     "home", "bubble", None, {}),

    ("narrator",
     "El visitante abre el chatbot desde cualquier página. Veamos cómo funciona.",
     "home", "open", "chat_empty", {}),

    # ACT 2: Chat
    ("lead",
     "Hola, necesito información sobre servicios SEO para mi empresa de comercio electrónico.",
     "home", "open", "chat", {"messages": [
         ("user", "Hola, necesito información sobre servicios SEO para ecommerce."),
     ]}),

    ("narrator",
     "La inteligencia artificial detecta automáticamente la línea de negocio Boostic y responde con información del knowledge base.",
     "home", "open", "chat", {"messages": [
         ("user", "Hola, necesito información sobre SEO para ecommerce."),
         ("bot", "¡Hola! Soy el asistente de Redegal. Para SEO y growth marketing, nuestro equipo Boostic es experto. ¿Quieres hablar con un especialista?"),
     ]}),

    ("narrator",
     "El bot ofrece opciones: llamar desde el navegador con WebRTC, o recibir una llamada al teléfono.",
     "home", "open", "chat", {"messages": [
         ("user", "Necesito información sobre SEO para ecommerce."),
         ("bot", "Nuestro equipo Boostic es experto en SEO. ¿Prefieres hablar con un especialista?"),
         ("bot", "Puedes: 🖥 Llamar desde el navegador · 📞 Que te llamemos al teléfono"),
     ]}),

    # ACT 3: WebRTC Call
    ("narrator",
     "El visitante elige llamar desde el navegador. Primera opción: WebRTC, sin necesidad de teléfono.",
     "solutions", "open", "call_chooser", {}),

    ("narrator",
     "El sistema verifica el micrófono, la conexión de red y el servidor Janus. Tres comprobaciones verdes.",
     "solutions", "open", "preflight", {"checks": 3}),

    ("narrator",
     "La llamada se enruta: del navegador a Janus Gateway, por SIP a Vozelia, y la extensión del agente empieza a sonar.",
     "solutions", "open", "calling", {"mode": "webrtc", "status": "calling"}),

    ("narrator",
     "Conexión establecida. Escuchemos la conversación entre el agente David y la lead María.",
     "solutions", "open", "calling", {"mode": "webrtc", "status": "connected", "duration": "00:00"}),

    ("agent",
     "Hola, soy David del equipo de Boostic en Redegal. ¿En qué puedo ayudarle?",
     "solutions", "open", "calling", {"mode": "webrtc", "status": "connected", "duration": "00:12"}),

    ("lead",
     "Hola David, tenemos una tienda online de moda y necesitamos mejorar nuestro posicionamiento en Google.",
     "solutions", "open", "calling", {"mode": "webrtc", "status": "connected", "duration": "00:28"}),

    ("agent",
     "Perfecto, tenemos mucha experiencia en SEO para ecommerce. ¿Cuál es su facturación mensual aproximada?",
     "solutions", "open", "calling", {"mode": "webrtc", "status": "connected", "duration": "00:45"}),

    ("lead",
     "Estamos facturando unos cincuenta mil euros al mes, pero sabemos que podemos crecer mucho más.",
     "solutions", "open", "calling", {"mode": "webrtc", "status": "connected", "duration": "01:02"}),

    ("agent",
     "Excelente. Le prepararé una propuesta personalizada esta misma semana. ¿Me puede dar su email?",
     "solutions", "open", "calling", {"mode": "webrtc", "status": "connected", "duration": "01:35"}),

    ("lead",
     "Claro, es maría punto garcía arroba moda demo punto com.",
     "solutions", "open", "calling", {"mode": "webrtc", "status": "connected", "duration": "01:50"}),

    ("agent",
     "Perfecto María, le enviaré la propuesta mañana. Ha sido un placer hablar con usted.",
     "cases", "open", "calling", {"mode": "webrtc", "status": "connected", "duration": "02:15"}),

    ("lead",
     "Igualmente David, muchas gracias.",
     "cases", "open", "calling", {"mode": "webrtc", "status": "connected", "duration": "02:28"}),

    ("narrator",
     "La llamada WebRTC finaliza. Duración tres minutos cuarenta y siete segundos. La grabación se almacena y transcribe automáticamente.",
     "cases", "open", "calling", {"mode": "webrtc", "status": "ended", "duration": "03:47"}),

    # ACT 4: Click2Call Callback
    ("narrator",
     "Segunda opción: callback telefónico. El visitante introduce su número de teléfono en el widget.",
     "about", "open", "phone_input", {}),

    ("narrator",
     "El servidor envía un INVITE SIP a Vozelia. El teléfono del visitante empieza a sonar.",
     "about", "open", "sip_flow", {"step": "ringing"}),

    ("narrator",
     "El visitante contesta. El servidor transfiere la llamada al agente mediante REFER SIP. Ambos quedan conectados.",
     "about", "open", "sip_flow", {"step": "connected"}),

    ("narrator",
     "Escuchemos esta segunda conversación de callback.",
     "about", "open", "calling", {"mode": "callback", "status": "connected", "duration": "00:00"}),

    ("agent",
     "Buenos días, le llamo desde Redegal. He visto que tiene interés en nuestros servicios de marketing digital.",
     "about", "open", "calling", {"mode": "callback", "status": "connected", "duration": "00:15"}),

    ("lead",
     "Sí, exacto. Necesitamos ayuda con campañas en Google Ads y redes sociales.",
     "about", "open", "calling", {"mode": "callback", "status": "connected", "duration": "00:32"}),

    ("agent",
     "Nuestro equipo tiene más de diez años de experiencia en SEM y Social Ads. ¿Tienen un presupuesto mensual definido?",
     "contact", "open", "calling", {"mode": "callback", "status": "connected", "duration": "00:55"}),

    ("lead",
     "Estamos pensando en invertir entre tres mil y cinco mil euros mensuales.",
     "contact", "open", "calling", {"mode": "callback", "status": "connected", "duration": "01:12"}),

    ("agent",
     "Con ese presupuesto podemos diseñar una estrategia muy efectiva. Puedo agendar una reunión con nuestro director.",
     "contact", "open", "calling", {"mode": "callback", "status": "connected", "duration": "01:40"}),

    ("lead",
     "Me parece perfecto. El martes por la mañana me viene bien.",
     "contact", "open", "calling", {"mode": "callback", "status": "connected", "duration": "01:55"}),

    ("narrator",
     "La llamada callback finaliza. Ambas llamadas quedan registradas con grabación completa.",
     "contact", "open", "calling", {"mode": "callback", "status": "ended", "duration": "02:34"}),

    # ACT 5: Dashboard
    ("narrator",
     "En el dashboard profesional, los agentes ven todas las conversaciones, llamadas y leads en tiempo real.",
     "home", "dashboard", "dashboard", {}),

    ("narrator",
     "El sistema notifica al comercial cuando hay un lead esperando. Las grabaciones se transcriben con inteligencia artificial.",
     "home", "dashboard", "dashboard", {}),

    ("narrator",
     "El chatbot aprende de cada interacción. El knowledge base se actualiza automáticamente para mejorar respuestas futuras.",
     "solutions", "dashboard", "dashboard", {}),

    # ACT 6: Closing
    ("narrator",
     "Redegal Chatbot: inteligencia artificial, llamadas WebRTC y callback con grabación, cuatro idiomas, integración CRM, y dashboard profesional.",
     "home", "open", "chat", {"messages": [
         ("bot", "Redegal Chatbot — Sistema completo"),
         ("bot", "✓ IA multi-proveedor (Claude + Gemini + OpenAI)"),
         ("bot", "✓ WebRTC + Click2Call con grabación"),
         ("bot", "✓ 4 idiomas · CRM · Dashboard"),
         ("bot", "✓ Multi-tenant · Docker · Producción"),
     ]}),

    ("narrator",
     "Todo listo para producción. Personalizable, multi-tenant, desplegable con Docker. Gracias por ver esta demostración.",
     "home", "bubble", None, {}),
]


def build_slide(index, scene, screenshots):
    """Build a composite slide: real website screenshot + widget overlay."""
    from PIL import Image, ImageDraw

    speaker, text, page, widget_state, draw_func, extra = scene

    # Load website screenshot
    bg = Image.open(screenshots[page]).convert("RGB")
    bg = bg.resize((1920, 1080), Image.LANCZOS)

    draw = ImageDraw.Draw(bg)

    if draw_func == "dashboard":
        draw = draw_dashboard_overlay(bg, draw)
    else:
        # Draw widget
        body = draw_widget_frame(bg, draw, state=widget_state)

        if body and draw_func:
            if draw_func == "chat_empty":
                draw_chat_messages(draw, body, [])
            elif draw_func == "chat":
                draw_chat_messages(draw, body, extra.get("messages", []))
            elif draw_func == "call_chooser":
                draw_call_chooser(draw, body)
            elif draw_func == "preflight":
                draw_preflight(draw, body, extra.get("checks", 3))
            elif draw_func == "calling":
                draw_calling_screen(draw, body,
                                    status=extra.get("status", "calling"),
                                    mode=extra.get("mode", "webrtc"),
                                    duration=extra.get("duration"))
            elif draw_func == "phone_input":
                draw_phone_input(draw, body)
            elif draw_func == "sip_flow":
                draw_sip_flow(draw, body, step=extra.get("step", "invite"))

    # Save
    outpath = os.path.join(SLIDES_DIR, f"{index:03d}.png")
    bg.save(outpath, "PNG", quality=95)
    return outpath


def generate_audio(index, speaker, text):
    """Generate audio using edge-tts with = format for params."""
    voice, rate, pitch = VOICES[speaker]
    outfile = os.path.join(AUDIO_DIR, f"{index:03d}.mp3")

    if os.path.exists(outfile):
        os.remove(outfile)

    cmd = [
        sys.executable, "-m", "edge_tts",
        "--voice", voice,
        f"--rate={rate}",
        f"--pitch={pitch}",
        "--text", text,
        "--write-media", outfile,
    ]

    for attempt in range(2):
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if os.path.exists(outfile) and os.path.getsize(outfile) > 1000:
            return outfile
        if attempt == 0:
            print(f"  ⚠ TTS retry for segment {index}...")

    print(f"  ❌ TTS failed for segment {index}")
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-t", "3", "-c:a", "libmp3lame", "-q:a", "9", outfile
    ], capture_output=True)
    return outfile


def get_duration(filepath):
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", filepath],
        capture_output=True, text=True)
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 3.0


def main():
    print("🎬 Redegal Chatbot — Video Generator v3")
    print("   Real website screenshots + widget overlay + Edge TTS")
    print("=" * 60)

    # Step 1: Capture screenshots
    screenshots = capture_screenshots()

    # Step 2: Generate audio
    print(f"\n🎙 Generating {len(SCENES)} audio segments...")
    segments = []
    for i, (speaker, text, page, ws, df, extra) in enumerate(SCENES):
        print(f"  [{i+1}/{len(SCENES)}] {speaker}: {text[:55]}...")
        audio = generate_audio(i, speaker, text)
        dur = get_duration(audio)
        print(f"           → {dur:.1f}s, {os.path.getsize(audio)//1024}KB")
        segments.append({"audio": audio, "duration": dur})

    # Step 3: Generate composite slides
    print(f"\n🎨 Generating {len(SCENES)} composite slides (website + widget)...")
    for i, scene in enumerate(SCENES):
        img = build_slide(i, scene, screenshots)
        segments[i]["image"] = img
        sz = os.path.getsize(img) // 1024
        print(f"  [{i+1}/{len(SCENES)}] {scene[2]} + {scene[4] or 'bubble'} → {sz}KB")

    # Step 4: Create video segments
    print(f"\n🔧 Creating {len(segments)} video segments...")
    seg_files = []
    for i, seg in enumerate(segments):
        seg_video = os.path.join(SLIDES_DIR, f"seg_{i:03d}.mp4")
        dur = seg["duration"] + 0.5

        result = subprocess.run([
            "ffmpeg", "-y",
            "-loop", "1", "-i", seg["image"],
            "-i", seg["audio"],
            "-c:v", "libx264", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
            "-pix_fmt", "yuv420p",
            "-t", str(dur),
            "-vf", "scale=1920:1080",
            seg_video
        ], capture_output=True, text=True)

        if os.path.exists(seg_video) and os.path.getsize(seg_video) > 1000:
            seg_files.append(seg_video)
            print(f"  [{i+1}/{len(segments)}] ✓ {seg['duration']:.1f}s")
        else:
            print(f"  [{i+1}/{len(segments)}] ❌ FAILED: {result.stderr[:200] if result.stderr else 'unknown'}")

    # Step 5: Concatenate
    print(f"\n🎬 Concatenating {len(seg_files)} segments...")
    concat_file = os.path.join(SLIDES_DIR, "concat.txt")
    with open(concat_file, "w") as f:
        for sf in seg_files:
            f.write(f"file '{sf}'\n")

    result = subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        OUTPUT
    ], capture_output=True, text=True)

    if os.path.exists(OUTPUT) and os.path.getsize(OUTPUT) > 10000:
        size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
        total_dur = sum(s["duration"] for s in segments)
        print(f"\n✅ Video generated: {OUTPUT}")
        print(f"   Duration: ~{total_dur:.0f}s ({total_dur/60:.1f} min)")
        print(f"   Size: {size_mb:.1f} MB")
        print(f"   Resolution: 1920x1080")
        print(f"   Scenes: {len(SCENES)} (website + chatbot widget)")
        print(f"   Voices: Jorge MX (narrator) + Álvaro (agent) + Elvira (lead)")
    else:
        print(f"\n❌ Video creation failed!")
        if result.stderr:
            print(result.stderr[:500])

    # Cleanup temp segments (keep screenshots and audio for debugging)
    print("\n🧹 Cleaning temp segment videos...")
    for f in seg_files:
        try:
            os.remove(f)
        except OSError:
            pass
    try:
        os.remove(concat_file)
    except OSError:
        pass


if __name__ == "__main__":
    main()
