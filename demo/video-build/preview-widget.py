#!/usr/bin/env python3
"""Generate a single preview slide with the real widget design."""

import os
import time
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ─── Colors (real widget specs) ───
PRIMARY = "#007fff"
PRIMARY_DARK = "#0055CC"
PRIMARY_LIGHT = "#E0F0FF"
SUCCESS = "#00D084"
WARNING = "#FCB900"
ERROR_C = "#CF2E2E"
TEXT_PRIMARY = "#1A1A2E"
TEXT_SECONDARY = "#5A6178"
TEXT_TERTIARY = "#8B92A8"
SURFACE = "#F7F9FC"
BORDER = "#E5E9F0"
BUBBLE_USER_1 = "#007fff"
BUBBLE_USER_2 = "#0066cc"
BUBBLE_BOT = "#F1F5F9"
WHITE = "#FFFFFF"

W_WIDTH = 400
W_HEIGHT = 640
W_RADIUS = 20
W_MARGIN = 24
HEADER_H = 68


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def hex_rgba(h, a=255):
    return (*hex_rgb(h), a)


def load_font(size, bold=False):
    paths = [
        "/Library/Fonts/SF-Pro-Display-Bold.otf" if bold else "/Library/Fonts/SF-Pro-Display-Regular.otf",
        "/Library/Fonts/SF-Pro-Text-Bold.otf" if bold else "/Library/Fonts/SF-Pro-Text-Regular.otf",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def gradient_rect(img, xy, color1, color2, direction="vertical"):
    """Draw a gradient-filled rectangle."""
    x1, y1, x2, y2 = [int(v) for v in xy]
    for i in range(max(y2 - y1, 1)):
        ratio = i / max(y2 - y1 - 1, 1)
        if direction == "diagonal":
            ratio = i / max(y2 - y1 - 1, 1)
        r = int(color1[0] + (color2[0] - color1[0]) * ratio)
        g = int(color1[1] + (color2[1] - color1[1]) * ratio)
        b = int(color1[2] + (color2[2] - color1[2]) * ratio)
        ImageDraw.Draw(img).line([(x1, y1 + i), (x2, y1 + i)], fill=(r, g, b))


def draw_widget_premium(bg, widget_content="chat"):
    """Draw the premium widget on a background image."""
    W, H = bg.size
    draw = ImageDraw.Draw(bg)

    # Widget position
    wx = W - W_WIDTH - W_MARGIN
    wy = H - W_HEIGHT - W_MARGIN - 20

    # ─── Drop Shadow ───
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    for i in range(16):
        alpha = max(16 - i, 1)
        sdraw.rounded_rectangle(
            [wx - i, wy - i + 4, wx + W_WIDTH + i, wy + W_HEIGHT + i + 4],
            radius=W_RADIUS + i, fill=(0, 0, 0, alpha))
    bg_rgba = bg.convert("RGBA")
    bg_rgba = Image.alpha_composite(bg_rgba, shadow)
    bg.paste(bg_rgba.convert("RGB"))
    draw = ImageDraw.Draw(bg)

    # ─── Widget body (white) ───
    draw.rounded_rectangle(
        [wx, wy, wx + W_WIDTH, wy + W_HEIGHT],
        radius=W_RADIUS, fill=hex_rgb(WHITE), outline=hex_rgb(BORDER), width=1)

    # ─── Header gradient ───
    # Create header as separate image then paste with mask
    header = Image.new("RGB", (W_WIDTH, HEADER_H + 12), hex_rgb(PRIMARY))
    # Gradient
    gradient_rect(header, (0, 0, W_WIDTH, HEADER_H + 12),
                  hex_rgb(PRIMARY), hex_rgb(PRIMARY_DARK))
    hdraw = ImageDraw.Draw(header)

    # Decorative dots pattern (subtle)
    for dx in range(0, W_WIDTH, 30):
        for dy in range(0, HEADER_H, 30):
            hdraw.ellipse([dx, dy, dx + 2, dy + 2], fill=(255, 255, 255, 15))

    # Header content
    # Avatar
    hdraw.rounded_rectangle([16, 16, 52, 52], radius=10,
                            fill=(255, 255, 255, 40))
    font_avatar = load_font(18, bold=True)
    hdraw.text((27, 22), "R", fill=(255, 255, 255), font=font_avatar)

    # Title + status
    font_title = load_font(15, bold=True)
    font_status = load_font(11)
    hdraw.text((64, 16), "Redegal Chat", fill=(255, 255, 255), font=font_title)

    # Status dot (green = online)
    hdraw.ellipse([64, 38, 71, 45], fill=hex_rgb(SUCCESS))
    hdraw.text((76, 36), "Online", fill=(255, 255, 255, 200), font=font_status)

    # Beta badge
    font_badge = load_font(8, bold=True)
    badge_x = 120
    hdraw.rounded_rectangle([badge_x, 36, badge_x + 34, 48],
                            radius=10, fill=(255, 255, 255, 38),
                            outline=(255, 255, 255, 77), width=1)
    hdraw.text((badge_x + 5, 37), "BETA", fill=(255, 255, 255), font=font_badge)

    # Header buttons (dark mode, sound, lang, close)
    btn_icons = ["◐", "♪", "ES", "✕"]
    for i, icon in enumerate(btn_icons):
        bx = W_WIDTH - 40 - i * 36
        hdraw.rounded_rectangle([bx, 18, bx + 32, 50],
                                radius=8, fill=(255, 255, 255, 30))
        font_btn = load_font(12)
        hdraw.text((bx + 8, 26), icon, fill=(255, 255, 255), font=font_btn)

    # Paste header with rounded top corners mask
    mask = Image.new("L", (W_WIDTH, HEADER_H + 12), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, W_WIDTH, HEADER_H + 12], radius=W_RADIUS, fill=255)
    mdraw.rectangle([0, W_RADIUS, W_WIDTH, HEADER_H + 12], fill=255)
    bg.paste(header, (wx, wy), mask)
    draw = ImageDraw.Draw(bg)

    body_y = wy + HEADER_H
    body_h = W_HEIGHT - HEADER_H

    return (wx, body_y, W_WIDTH, body_h, draw)


def draw_chat_messages_premium(draw, wx, body_y, ww, body_h, messages):
    """Draw premium chat messages."""
    import textwrap

    font_msg = load_font(14)
    font_name = load_font(11, bold=True)
    font_time = load_font(10)
    y = body_y + 14
    pad = 14

    for sender, text, ts in messages:
        if y > body_y + body_h - 80:
            break

        lines = textwrap.wrap(text, width=34)
        line_h = 20
        bubble_h = len(lines) * line_h + 18

        if sender == "user":
            # Right-aligned gradient blue bubble
            max_tw = max(draw.textbbox((0, 0), l, font=font_msg)[2] for l in lines)
            bw = max_tw + 32
            bx = wx + ww - bw - pad
            # Gradient bubble (simplified - solid blue)
            draw.rounded_rectangle(
                [bx, y, bx + bw, y + bubble_h],
                radius=20, fill=hex_rgb(PRIMARY))
            # Bottom-right corner cut
            draw.rounded_rectangle(
                [bx + bw - 20, y + bubble_h - 16, bx + bw, y + bubble_h],
                radius=3, fill=hex_rgb(PRIMARY))

            ty = y + 9
            for line in lines:
                draw.text((bx + 16, ty), line, fill=(255, 255, 255), font=font_msg)
                ty += line_h

            # Timestamp
            draw.text((bx + bw - 45, y + bubble_h + 3), ts,
                      fill=hex_rgb(TEXT_TERTIARY), font=font_time)
            y += bubble_h + 22

        elif sender in ("bot", "agent"):
            # Avatar
            av_x = wx + pad
            av_y = y
            if sender == "bot":
                draw.ellipse([av_x, av_y, av_x + 30, av_y + 30],
                             fill=hex_rgb(PRIMARY))
                draw.text((av_x + 9, av_y + 6), "✦", fill=(255, 255, 255),
                          font=load_font(12, bold=True))
                name_text = "Redegal Bot"
                name_color = hex_rgb(PRIMARY)
            else:
                draw.ellipse([av_x, av_y, av_x + 30, av_y + 30],
                             fill=hex_rgb(SUCCESS))
                draw.text((av_x + 9, av_y + 6), "D", fill=(255, 255, 255),
                          font=load_font(12, bold=True))
                name_text = "David — Agente Boostic"
                name_color = hex_rgb(PRIMARY)

            # Name
            draw.text((av_x + 38, av_y + 2), name_text,
                      fill=name_color, font=font_name)

            # Bubble
            max_tw = max(draw.textbbox((0, 0), l, font=font_msg)[2] for l in lines)
            bw = max_tw + 32
            bx = av_x + 38
            by = av_y + 18
            draw.rounded_rectangle(
                [bx, by, bx + bw, by + bubble_h],
                radius=20, fill=hex_rgb(BUBBLE_BOT),
                outline=hex_rgb("#F0F3F8"), width=1)
            # Bottom-left corner cut
            draw.rounded_rectangle(
                [bx, by + bubble_h - 16, bx + 14, by + bubble_h],
                radius=3, fill=hex_rgb(BUBBLE_BOT))

            ty = by + 9
            for line in lines:
                draw.text((bx + 16, ty), line, fill=hex_rgb(TEXT_PRIMARY), font=font_msg)
                ty += line_h

            # Timestamp
            draw.text((bx + 4, by + bubble_h + 3), ts,
                      fill=hex_rgb(TEXT_TERTIARY), font=font_time)
            y = by + bubble_h + 22

    # ─── Input Area ───
    input_y = body_y + body_h - 56
    # Border top
    draw.line([(wx + 1, input_y - 8), (wx + ww - 1, input_y - 8)],
              fill=hex_rgb(BORDER), width=1)
    # Input pill
    draw.rounded_rectangle(
        [wx + 14, input_y, wx + ww - 62, input_y + 42],
        radius=9999, fill=hex_rgb(SURFACE),
        outline=hex_rgb(BORDER), width=1)
    draw.text((wx + 32, input_y + 12), "Escribe un mensaje...",
              fill=hex_rgb(TEXT_TERTIARY), font=load_font(14))

    # Send button (circle)
    sb_x = wx + ww - 52
    draw.ellipse([sb_x, input_y + 1, sb_x + 42, input_y + 43],
                 fill=hex_rgb(SURFACE))
    draw.text((sb_x + 13, input_y + 10), "➤",
              fill=hex_rgb(TEXT_TERTIARY), font=load_font(16))


def draw_call_view_premium(draw, wx, body_y, ww, body_h, mode="webrtc", status="connected", duration="01:23"):
    """Draw premium call view."""
    font_badge = load_font(11, bold=True)
    font_name = load_font(18, bold=True)
    font_role = load_font(13)
    font_dur = load_font(28, bold=True)
    font_quality = load_font(11)
    font_small = load_font(12)

    cy = body_y + 24

    # Mode badge
    label = "WebRTC" if mode == "webrtc" else "Click2Call"
    badge_color = hex_rgb(PRIMARY) if mode == "webrtc" else hex_rgb(WARNING)
    pill_w = len(label) * 8 + 24
    cx_center = wx + ww // 2
    draw.rounded_rectangle(
        [cx_center - pill_w // 2, cy, cx_center + pill_w // 2, cy + 24],
        radius=12, fill=badge_color)
    draw.text((cx_center - pill_w // 2 + 12, cy + 4), label,
              fill=(255, 255, 255), font=font_badge)
    cy += 44

    # Avatar circle (large)
    av_r = 40
    if status == "connected":
        av_bg = hex_rgb(SUCCESS)
    elif status == "calling":
        av_bg = hex_rgb(PRIMARY)
    else:
        av_bg = hex_rgb(SUCCESS)

    # Glow rings for connected
    if status == "connected":
        for i in range(3):
            r = av_r + 8 + i * 10
            glow_alpha = max(30 - i * 10, 5)
            draw.ellipse(
                [cx_center - r, cy - r + av_r, cx_center + r, cy + r + av_r],
                outline=(*hex_rgb(SUCCESS), glow_alpha), width=2)

    draw.ellipse(
        [cx_center - av_r, cy, cx_center + av_r, cy + av_r * 2],
        fill=av_bg)
    draw.text((cx_center - 14, cy + 22), "DV",
              fill=(255, 255, 255), font=font_name)
    cy += av_r * 2 + 16

    # Name
    draw.text((cx_center - 60, cy), "David Vázquez",
              fill=hex_rgb(TEXT_PRIMARY), font=font_name)
    cy += 26
    draw.text((cx_center - 50, cy), "Agente Boostic",
              fill=hex_rgb(TEXT_SECONDARY), font=font_role)
    cy += 32

    if status == "connected":
        # Duration
        draw.text((cx_center - 30, cy), duration,
                  fill=hex_rgb(TEXT_PRIMARY), font=font_dur)
        cy += 40

        # Audio waveform bars
        bar_colors = hex_rgb(SUCCESS)
        bar_x = cx_center - 28
        import random
        random.seed(42)
        for i in range(7):
            bh = random.randint(6, 22)
            draw.rounded_rectangle(
                [bar_x + i * 9, cy + 22 - bh, bar_x + i * 9 + 4, cy + 22],
                radius=2, fill=(*bar_colors, 128))
        cy += 34

        # Quality
        draw.text((cx_center - 60, cy), "🔒 Cifrado · Grabando · MOS 4.2",
                  fill=hex_rgb(TEXT_TERTIARY), font=font_quality)

        # Signal bars (top right of body)
        sx = wx + ww - 40
        sy = body_y + 14
        bar_heights = [4, 7, 10, 13, 16]
        for i, bh in enumerate(bar_heights):
            draw.rounded_rectangle(
                [sx + i * 6, sy + 16 - bh, sx + i * 6 + 3, sy + 16],
                radius=1, fill=hex_rgb(SUCCESS))

    elif status == "calling":
        # Expanding rings
        for i in range(3):
            r = 60 + i * 18
            draw.ellipse(
                [cx_center - r, body_y + 80 + av_r - r,
                 cx_center + r, body_y + 80 + av_r + r],
                outline=(*hex_rgb(PRIMARY), max(40 - i * 12, 8)), width=2)
        draw.text((cx_center - 40, cy), "Llamando...",
                  fill=hex_rgb(TEXT_SECONDARY), font=font_role)

    elif status == "ended":
        # Checkmark
        draw.text((cx_center - 10, cy - 5), "✓",
                  fill=hex_rgb(SUCCESS), font=load_font(32, bold=True))
        cy += 36
        draw.text((cx_center - 50, cy), "Llamada finalizada",
                  fill=hex_rgb(TEXT_SECONDARY), font=font_role)
        cy += 28
        if duration:
            draw.text((cx_center - 30, cy), duration,
                      fill=hex_rgb(TEXT_PRIMARY), font=font_dur)
            cy += 40
        draw.text((cx_center - 70, cy), "✓ Grabación guardada",
                  fill=hex_rgb(SUCCESS), font=font_small)
        cy += 20
        draw.text((cx_center - 70, cy), "✓ Transcripción IA lista",
                  fill=hex_rgb(SUCCESS), font=font_small)

    # ─── Bottom controls ───
    ctrl_y = body_y + body_h - 72
    if status == "connected":
        # Mute
        draw.ellipse([cx_center - 72, ctrl_y, cx_center - 24, ctrl_y + 48],
                     fill=hex_rgb(SURFACE))
        draw.text((cx_center - 56, ctrl_y + 12), "🎤",
                  font=load_font(16))
        # Hangup (red gradient)
        draw.ellipse([cx_center - 24, ctrl_y, cx_center + 24, ctrl_y + 48],
                     fill=hex_rgb(ERROR_C))
        draw.text((cx_center - 8, ctrl_y + 12), "📞",
                  font=load_font(16))
        # Speaker
        draw.ellipse([cx_center + 24, ctrl_y, cx_center + 72, ctrl_y + 48],
                     fill=hex_rgb(SURFACE))
        draw.text((cx_center + 40, ctrl_y + 12), "🔊",
                  font=load_font(16))
    elif status == "calling":
        draw.ellipse([cx_center - 24, ctrl_y, cx_center + 24, ctrl_y + 48],
                     fill=hex_rgb(ERROR_C))
        draw.text((cx_center - 8, ctrl_y + 12), "📞",
                  font=load_font(16))


def draw_call_chooser_premium(draw, wx, body_y, ww, body_h):
    """Draw premium call mode chooser."""
    font_title = load_font(20, bold=True)
    font_desc = load_font(13)
    font_btn = load_font(14, bold=True)
    font_sub = load_font(12)

    cy = body_y + 30

    # Icon container (dashed spinning border feel)
    cx = wx + ww // 2
    draw.rounded_rectangle([cx - 32, cy, cx + 32, cy + 64],
                           radius=20, fill=hex_rgb(PRIMARY_LIGHT))
    draw.text((cx - 10, cy + 16), "📞", font=load_font(26))
    cy += 80

    # Title
    title = "¿Cómo quieres llamar?"
    bbox = draw.textbbox((0, 0), title, font=font_title)
    tw = bbox[2] - bbox[0]
    draw.text((cx - tw // 2, cy), title,
              fill=hex_rgb(TEXT_PRIMARY), font=font_title)
    cy += 32

    sub = "Elige tu método de contacto preferido"
    bbox = draw.textbbox((0, 0), sub, font=font_desc)
    tw = bbox[2] - bbox[0]
    draw.text((cx - tw // 2, cy), sub,
              fill=hex_rgb(TEXT_SECONDARY), font=font_desc)
    cy += 44

    # Browser Call Button (primary gradient)
    btn_h = 70
    draw.rounded_rectangle([wx + 20, cy, wx + ww - 20, cy + btn_h],
                           radius=14, fill=hex_rgb(PRIMARY))
    draw.text((wx + 52, cy + 12), "🖥  Llamar desde el navegador",
              fill=(255, 255, 255), font=font_btn)
    draw.text((wx + 52, cy + 34), "WebRTC · Audio HD · Sin teléfono",
              fill=(200, 230, 255), font=font_sub)
    # Shadow
    cy += btn_h + 14

    # Callback Button (outlined)
    draw.rounded_rectangle([wx + 20, cy, wx + ww - 20, cy + btn_h],
                           radius=14, fill=hex_rgb(WHITE),
                           outline=hex_rgb(BORDER), width=2)
    draw.text((wx + 52, cy + 12), "📞  Que me llamen al teléfono",
              fill=hex_rgb(TEXT_PRIMARY), font=font_btn)
    draw.text((wx + 52, cy + 34), "Click2Call · Callback SIP",
              fill=hex_rgb(TEXT_SECONDARY), font=font_sub)
    cy += btn_h + 30

    draw.text((wx + ww // 2 - 90, cy),
              "Ambas incluyen grabación + IA",
              fill=hex_rgb(TEXT_TERTIARY), font=font_sub)


def draw_fab_premium(draw, W, H):
    """Draw the premium FAB button."""
    fab_x = W - 60 - W_MARGIN
    fab_y = H - 60 - W_MARGIN

    # Pulse ring
    for i in range(3):
        r = 30 + i * 8
        draw.ellipse(
            [fab_x + 30 - r, fab_y + 30 - r, fab_x + 30 + r, fab_y + 30 + r],
            outline=(*hex_rgb(PRIMARY), max(30 - i * 10, 5)), width=2)

    # FAB circle
    draw.ellipse([fab_x, fab_y, fab_x + 60, fab_y + 60],
                 fill=hex_rgb(PRIMARY))
    # Chat icon
    draw.text((fab_x + 18, fab_y + 16), "💬",
              font=load_font(22))


def generate_preview():
    """Generate 4 preview slides showing different widget states."""
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--no-sandbox")
    driver = webdriver.Chrome(options=opts)

    # Capture homepage
    driver.get("http://localhost:3847/")
    time.sleep(1.5)
    home_path = "/tmp/preview_home.png"
    driver.save_screenshot(home_path)

    driver.get("http://localhost:3847/solutions")
    time.sleep(1.5)
    sol_path = "/tmp/preview_solutions.png"
    driver.save_screenshot(sol_path)

    driver.quit()

    previews = []

    # Preview 1: Chat with messages
    bg = Image.open(home_path).convert("RGB").resize((1920, 1080), Image.LANCZOS)
    result = draw_widget_premium(bg, "chat")
    wx, body_y, ww, body_h, draw = result
    draw_chat_messages_premium(draw, wx, body_y, ww, body_h, [
        ("user", "Hola, necesito información sobre servicios SEO para ecommerce.", "10:32"),
        ("bot", "¡Hola! Para SEO y growth, nuestro equipo Boostic es experto. ¿Quieres hablar con un especialista?", "10:32"),
        ("user", "Sí, ¿puedo llamar ahora?", "10:33"),
        ("bot", "Puedes llamar desde el navegador (WebRTC) o que te llamemos al teléfono.", "10:33"),
    ])
    p1 = "/tmp/preview_chat.png"
    bg.save(p1, "PNG")
    previews.append(p1)

    # Preview 2: Call chooser
    bg = Image.open(sol_path).convert("RGB").resize((1920, 1080), Image.LANCZOS)
    result = draw_widget_premium(bg, "call_chooser")
    wx, body_y, ww, body_h, draw = result
    draw_call_chooser_premium(draw, wx, body_y, ww, body_h)
    p2 = "/tmp/preview_chooser.png"
    bg.save(p2, "PNG")
    previews.append(p2)

    # Preview 3: WebRTC connected call
    bg = Image.open(sol_path).convert("RGB").resize((1920, 1080), Image.LANCZOS)
    result = draw_widget_premium(bg, "call")
    wx, body_y, ww, body_h, draw = result
    draw_call_view_premium(draw, wx, body_y, ww, body_h,
                           mode="webrtc", status="connected", duration="01:23")
    p3 = "/tmp/preview_webrtc.png"
    bg.save(p3, "PNG")
    previews.append(p3)

    # Preview 4: FAB only (bubble)
    bg = Image.open(home_path).convert("RGB").resize((1920, 1080), Image.LANCZOS)
    draw = ImageDraw.Draw(bg)
    draw_fab_premium(draw, 1920, 1080)
    p4 = "/tmp/preview_fab.png"
    bg.save(p4, "PNG")
    previews.append(p4)

    return previews


if __name__ == "__main__":
    print("Generating premium widget previews...")
    paths = generate_preview()
    for p in paths:
        sz = os.path.getsize(p) // 1024
        print(f"  ✓ {os.path.basename(p)} ({sz}KB)")
    print("Done!")
