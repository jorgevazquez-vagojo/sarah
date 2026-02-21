#!/usr/bin/env python3
"""
Redegal Chatbot — Demo Video Generator v2
MP4 with Microsoft Edge TTS voices + Pillow slides + ffmpeg.

Voices (3 distinct):
  - Narrator (Jorge MX, -5% rate): professional, deeper narrator
  - Agent/David (Alvaro ES, +3Hz pitch): commercial agent
  - Lead/María (Elvira ES): website visitor

Scenes: Chat → WebRTC call → Click2Call callback → Dashboard
"""

import subprocess
import os
import sys
import textwrap

BASEDIR = os.path.dirname(__file__)
AUDIO_DIR = os.path.join(BASEDIR, "audio2")
SLIDES_DIR = os.path.join(BASEDIR, "slides2")
OUTPUT = os.path.expanduser("~/Downloads/redegal-chatbot-demo.mp4")

os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(SLIDES_DIR, exist_ok=True)

# ─── Voices ───
VOICES = {
    "narrator": ("es-MX-JorgeNeural", "-5%", "+0Hz"),
    "agent":    ("es-ES-AlvaroNeural", "+0%", "+3Hz"),
    "lead":     ("es-ES-ElviraNeural", "+0%", "+0Hz"),
}

# ─── Script ───
# (speaker, text, slide_title, slide_subtitle, accent_color)
SCRIPT = [
    # ACT 1: Intro
    ("narrator",
     "Bienvenidos a la demostración del sistema de comunicaciones inteligente de Redegal.",
     "Redegal Chatbot", "WebRTC + Click2Call Demo", "#00d4aa"),

    ("narrator",
     "Veremos las dos formas de llamada: desde el navegador con WebRTC, y mediante callback telefónico.",
     "Dos Modos de Llamada", "WebRTC (navegador) + Click2Call (callback)", "#00d4aa"),

    ("narrator",
     "La arquitectura usa Janus Gateway como puente entre WebRTC y SIP. La PBX de Vozelia Cloud gestiona las extensiones.",
     "Arquitectura",
     "Widget → Janus Gateway → SIP/UDP → Vozelia PBX → Agente", "#3b82f6"),

    ("narrator",
     "El stack incluye Node punto JS, React, PostgreSQL, Redis, Docker, e inteligencia artificial con Claude, Gemini y OpenAI.",
     "Stack Tecnológico",
     "Node.js 20 · React 19 · PostgreSQL 16 · Redis 7 · Docker · IA Multi-proveedor", "#6c5ce7"),

    # ACT 2: Chat
    ("narrator",
     "Un visitante llega a redegal punto com y abre el chatbot.",
     "💬  Chat con IA", "El visitante abre el widget", "#007fff"),

    ("lead",
     "Hola, necesito información sobre servicios SEO para mi empresa de comercio electrónico.",
     "💬  Visitante escribe", "\"Necesito información sobre SEO para ecommerce\"", "#ec4899"),

    ("narrator",
     "La inteligencia artificial detecta la línea de negocio Boostic y responde con información del knowledge base.",
     "🤖  IA Responde", "Detección automática: Línea Boostic (SEO & Growth)", "#00d4aa"),

    ("narrator",
     "El bot ofrece opciones enriquecidas: hablar con un experto, dejar datos, o llamar directamente.",
     "📋  Opciones Enriquecidas",
     "Llamar · Hablar con experto · Dejar datos", "#6c5ce7"),

    # ACT 3: WebRTC Call
    ("narrator",
     "El visitante elige llamar desde el navegador. Primera opción: WebRTC.",
     "📱  Elegir Modo de Llamada",
     "🖥  Llamar desde el navegador  |  📞 Que me llamen", "#3b82f6"),

    ("narrator",
     "El sistema verifica el micrófono, la conexión y el servidor. Tres checks verdes.",
     "✅  Verificación Preflight",
     "✓ Micrófono  ✓ Conexión  ✓ Servidor Janus", "#10b981"),

    ("narrator",
     "La llamada se enruta: navegador a Janus Gateway, de ahí por SIP a Vozelia, y la extensión del agente empieza a sonar.",
     "📡  Llamando vía WebRTC",
     "Browser → Janus → SIP → Vozelia PBX → Ext. 107", "#3b82f6"),

    ("narrator",
     "Conexión establecida. Escuchemos la conversación entre el comercial David y la lead María.",
     "🟢  Llamada WebRTC Conectada",
     "Duración: en curso · Calidad: MOS 4.2", "#10b981"),

    ("agent",
     "Hola, soy David del equipo de Boostic en Redegal. ¿En qué puedo ayudarle?",
     "🟢  WebRTC — Conversación",
     "🎤 David (Agente Boostic)", "#10b981"),

    ("lead",
     "Hola David, tenemos una tienda online de moda y necesitamos mejorar nuestro posicionamiento en Google.",
     "🟢  WebRTC — Conversación",
     "🎤 María (Lead)", "#ec4899"),

    ("agent",
     "Perfecto, tenemos mucha experiencia en SEO para ecommerce. ¿Cuál es su facturación mensual aproximada?",
     "🟢  WebRTC — Conversación",
     "🎤 David (Agente Boostic)", "#10b981"),

    ("lead",
     "Estamos facturando unos cincuenta mil euros al mes, pero sabemos que podemos crecer mucho más.",
     "🟢  WebRTC — Conversación",
     "🎤 María (Lead)", "#ec4899"),

    ("agent",
     "Excelente. Le prepararé una propuesta personalizada esta misma semana. ¿Me puede dar su email?",
     "🟢  WebRTC — Conversación",
     "🎤 David (Agente Boostic)", "#10b981"),

    ("lead",
     "Claro, es maría punto garcía arroba moda demo punto com.",
     "🟢  WebRTC — Conversación",
     "🎤 María (Lead)", "#ec4899"),

    ("agent",
     "Perfecto María, le enviaré la propuesta mañana. Ha sido un placer hablar con usted.",
     "🟢  WebRTC — Conversación",
     "🎤 David (Agente Boostic)", "#10b981"),

    ("lead",
     "Igualmente David, muchas gracias.",
     "🟢  WebRTC — Conversación",
     "🎤 María (Lead)", "#ec4899"),

    ("narrator",
     "La llamada finaliza. Duración tres minutos cuarenta y siete segundos. La grabación se almacena automáticamente y se transcribe con inteligencia artificial.",
     "✅  Llamada WebRTC Finalizada",
     "Duración: 03:47 · MOS: 4.2 · Grabación ✓ · Transcripción IA ✓", "#10b981"),

    # ACT 4: Click2Call
    ("narrator",
     "Segunda opción: callback telefónico. El visitante introduce su número de teléfono.",
     "📞  Click2Call — Teléfono",
     "Visitante introduce: +34 612 345 678", "#f59e0b"),

    ("narrator",
     "El servidor envía un INVITE SIP a Vozelia. El teléfono del visitante empieza a sonar.",
     "📡  SIP INVITE Enviado",
     "Server → Vozelia PBX → Teléfono visitante sonando...", "#f59e0b"),

    ("narrator",
     "El visitante contesta. El servidor transfiere la llamada al agente mediante REFER SIP. Ambas partes quedan conectadas.",
     "🔄  Transferencia SIP REFER",
     "Visitante contesta → REFER → Agente conectado", "#f59e0b"),

    ("narrator",
     "Escuchemos esta segunda conversación de callback.",
     "🟢  Callback Conectado",
     "Llamada bidireccional: Agente ↔ Visitante", "#10b981"),

    ("agent",
     "Buenos días, le llamo desde Redegal. He visto que tiene interés en nuestros servicios de marketing digital.",
     "🟢  Callback — Conversación",
     "🎤 David (Agente)", "#10b981"),

    ("lead",
     "Sí, exacto. Necesitamos ayuda con campañas en Google Ads y redes sociales.",
     "🟢  Callback — Conversación",
     "🎤 María (Lead)", "#ec4899"),

    ("agent",
     "Nuestro equipo tiene más de diez años de experiencia en SEM y Social Ads. ¿Tienen un presupuesto mensual definido?",
     "🟢  Callback — Conversación",
     "🎤 David (Agente)", "#10b981"),

    ("lead",
     "Estamos pensando en invertir entre tres mil y cinco mil euros mensuales.",
     "🟢  Callback — Conversación",
     "🎤 María (Lead)", "#ec4899"),

    ("agent",
     "Con ese presupuesto podemos diseñar una estrategia muy efectiva. Puedo agendar una reunión con nuestro director de marketing.",
     "🟢  Callback — Conversación",
     "🎤 David (Agente)", "#10b981"),

    ("lead",
     "Me parece perfecto. El martes por la mañana me viene bien.",
     "🟢  Callback — Conversación",
     "🎤 María (Lead)", "#ec4899"),

    ("narrator",
     "Ambas llamadas quedan registradas en el dashboard con grabación, duración y transcripción automática.",
     "✅  Ambas Llamadas Registradas",
     "Dashboard: WebRTC + Callback · Grabaciones · Transcripciones IA", "#10b981"),

    # ACT 5: Dashboard
    ("narrator",
     "En el dashboard, los agentes ven todas las conversaciones, llamadas, leads y analíticas en tiempo real.",
     "📊  Dashboard de Agentes",
     "Conversaciones · Llamadas · Leads · Analytics · Wallboard", "#6c5ce7"),

    ("narrator",
     "El sistema notifica al comercial cuando hay un lead esperando, mediante notificaciones en tiempo real, push y email.",
     "🔔  Notificaciones en Tiempo Real",
     "Redis pub/sub → Dashboard → Email → Push", "#f59e0b"),

    ("narrator",
     "Las grabaciones se transcriben con IA. El sistema aprende de cada interacción para mejorar las respuestas del bot.",
     "🧠  IA que Aprende",
     "CSAT → Training → Mejora continua → Knowledge base", "#00d4aa"),

    ("narrator",
     "El sistema soporta múltiples usuarios simultáneos con WebSocket por visitante, rate limiting y cola de agentes.",
     "⚡  Concurrencia Multi-usuario",
     "WebSocket/visitante · Rate limiting · Cola agentes · Redis sessions", "#3b82f6"),

    # ACT 6: Closing
    ("narrator",
     "Redegal Chatbot: inteligencia artificial, llamadas WebRTC y callback con grabación, cuatro idiomas, integración CRM, y dashboard profesional.",
     "🚀  Redegal Chatbot",
     "IA + WebRTC + Click2Call + 4 idiomas + CRM + Dashboard", "#00d4aa"),

    ("narrator",
     "Todo listo para producción. Multi-tenant, personalizable, desplegable con Docker. Gracias por ver esta demostración.",
     "Gracias",
     "redegal.com · Powered by Redegal Digital Tech", "#00d4aa"),
]


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def generate_slide(index, title, subtitle, accent, speaker, speech_text):
    """Generate a slide image using Pillow."""
    from PIL import Image, ImageDraw, ImageFont

    W, H = 1920, 1080
    img = Image.new("RGB", (W, H), hex_to_rgb("#0c0f1a"))
    draw = ImageDraw.Draw(img)

    # Background gradient effect (two subtle circles)
    accent_rgb = hex_to_rgb(accent)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.ellipse([100, 100, 700, 700], fill=(*accent_rgb, 12))
    odraw.ellipse([1300, 500, 1900, 1100], fill=(108, 92, 231, 10))
    img.paste(Image.alpha_composite(Image.new("RGBA", (W, H), (12, 15, 26, 255)), overlay).convert("RGB"))
    draw = ImageDraw.Draw(img)

    # Top accent bar
    bar_w = 200
    draw.rounded_rectangle(
        [W//2 - bar_w//2, 50, W//2 + bar_w//2, 54],
        radius=2, fill=accent_rgb)

    # Try to load nice fonts, fallback to default
    def load_font(size, bold=False):
        paths = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/SFNSDisplay.ttf",
            "/Library/Fonts/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
        ]
        for p in paths:
            try:
                return ImageFont.truetype(p, size)
            except (OSError, IOError):
                continue
        return ImageFont.load_default()

    font_title = load_font(56)
    font_sub = load_font(30)
    font_speaker = load_font(24)
    font_speech = load_font(22)
    font_footer = load_font(16)

    # Title
    title_lines = textwrap.wrap(title, width=40)
    y = 360 - len(title_lines) * 35
    for line in title_lines:
        bbox = draw.textbbox((0, 0), line, font=font_title)
        tw = bbox[2] - bbox[0]
        draw.text((W//2 - tw//2, y), line, fill=accent_rgb, font=font_title)
        y += 70

    # Subtitle
    sub_lines = textwrap.wrap(subtitle, width=60)
    y += 20
    for line in sub_lines:
        bbox = draw.textbbox((0, 0), line, font=font_sub)
        tw = bbox[2] - bbox[0]
        draw.text((W//2 - tw//2, y), line, fill=(226, 232, 240), font=font_sub)
        y += 45

    # Speaker indicator
    if speaker in ("agent", "lead"):
        y += 30
        sp_label = "🎤 David (Agente)" if speaker == "agent" else "🎤 María (Lead)"
        sp_color = hex_to_rgb("#3b82f6") if speaker == "agent" else hex_to_rgb("#ec4899")

        bbox = draw.textbbox((0, 0), sp_label, font=font_speaker)
        tw = bbox[2] - bbox[0]
        # Background pill
        pill_pad = 20
        draw.rounded_rectangle(
            [W//2 - tw//2 - pill_pad, y - 5, W//2 + tw//2 + pill_pad, y + 35],
            radius=18, fill=(*sp_color, ), outline=None)
        draw.text((W//2 - tw//2, y), sp_label, fill=(255, 255, 255), font=font_speaker)
        y += 60

        # Speech text in quotes
        speech_short = speech_text[:90] + ("..." if len(speech_text) > 90 else "")
        speech_display = f'"{speech_short}"'
        sp_lines = textwrap.wrap(speech_display, width=65)
        for line in sp_lines:
            bbox = draw.textbbox((0, 0), line, font=font_speech)
            tw = bbox[2] - bbox[0]
            draw.text((W//2 - tw//2, y), line, fill=(148, 163, 184), font=font_speech)
            y += 32

    # Footer
    footer = "Redegal Chatbot — WebRTC + Click2Call Demo"
    bbox = draw.textbbox((0, 0), footer, font=font_footer)
    tw = bbox[2] - bbox[0]
    draw.text((W//2 - tw//2, H - 50), footer, fill=(71, 85, 105), font=font_footer)

    # Slide number
    snum = f"{index + 1}/{len(SCRIPT)}"
    draw.text((W - 100, H - 50), snum, fill=(71, 85, 105), font=font_footer)

    outpath = os.path.join(SLIDES_DIR, f"{index:03d}.png")
    img.save(outpath, "PNG")
    return outpath


def generate_audio(index, speaker, text):
    """Generate audio using edge-tts (synchronous subprocess).
    Uses --key=value format for rate/pitch to avoid argparse issues with negative values.
    """
    voice, rate, pitch = VOICES[speaker]
    outfile = os.path.join(AUDIO_DIR, f"{index:03d}.mp3")

    # Remove stale file
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
            print(f"  ⚠ TTS failed for segment {index} (attempt 1), retrying...")

    print(f"  ❌ TTS failed permanently for segment {index}")
    if result.stderr:
        print(f"     stderr: {result.stderr[:150]}")
    # Create silence fallback (3s)
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
    print("🎬 Redegal Chatbot — Video Generator v2")
    print("=" * 50)

    segments = []

    # Step 1: Generate audio
    print(f"\n🎙 Generating {len(SCRIPT)} audio segments with Microsoft Edge TTS...")
    for i, (speaker, text, title, subtitle, color) in enumerate(SCRIPT):
        print(f"  [{i+1}/{len(SCRIPT)}] {speaker}: {text[:55]}...")
        audio = generate_audio(i, speaker, text)
        dur = get_duration(audio)
        print(f"           → {dur:.1f}s, {os.path.getsize(audio)//1024}KB")
        segments.append({
            "audio": audio,
            "duration": dur,
            "speaker": speaker,
            "text": text,
            "title": title,
            "subtitle": subtitle,
            "color": color,
        })

    # Step 2: Generate slides
    print(f"\n🎨 Generating {len(SCRIPT)} slide images with Pillow...")
    for i, seg in enumerate(segments):
        img = generate_slide(i, seg["title"], seg["subtitle"], seg["color"], seg["speaker"], seg["text"])
        seg["image"] = img
        print(f"  [{i+1}/{len(segments)}] {seg['title'][:40]}... → {os.path.getsize(img)//1024}KB")

    # Step 3: Create video segments
    print(f"\n🔧 Creating {len(segments)} video segments...")
    seg_files = []
    for i, seg in enumerate(segments):
        seg_video = os.path.join(SLIDES_DIR, f"seg_{i:03d}.mp4")
        dur = seg["duration"] + 0.8  # padding

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
            print(f"  [{i+1}/{len(segments)}] ❌ FAILED")
            if result.stderr:
                print(f"           {result.stderr[:200]}")

    if not seg_files:
        print("\n❌ No segments were created!")
        return

    # Step 4: Concatenate
    print(f"\n🎬 Concatenating {len(seg_files)} segments into final video...")
    concat_file = os.path.join(SLIDES_DIR, "concat.txt")
    with open(concat_file, "w") as f:
        for sf in seg_files:
            f.write(f"file '{sf}'\n")

    result = subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:v", "libx264", "-preset", "medium", "-crf", "22",
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
        print(f"   Voices: Alvaro (narrator/agent) + Elvira (lead)")
    else:
        print(f"\n❌ Final video creation failed!")
        if result.stderr:
            print(result.stderr[:500])


if __name__ == "__main__":
    main()
