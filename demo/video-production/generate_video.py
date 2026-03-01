#!/usr/bin/env python3
"""
Sarah — Generador de Video Demo Profesional
Genera video 30-45 min con narración Microsoft Edge TTS + slides Pillow + ffmpeg
"""

import os, sys, asyncio, math, textwrap, subprocess, json, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ═══════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════
W, H = 1920, 1080
FPS = 30
BASE = Path(__file__).parent
OUT = BASE / "output"
AUD = OUT / "audio"
FRM = OUT / "frames"
SEG = OUT / "segments"
FINAL = OUT / "sarah-demo-completo.mp4"

# Colors (Redegal brand)
C_BG = (10, 10, 26)
C_SURFACE = (20, 20, 35)
C_TEAL = (0, 212, 170)
C_PURPLE = (108, 92, 231)
C_RED = (227, 6, 19)
C_WHITE = (255, 255, 255)
C_LIGHT = (240, 240, 245)
C_MUTED = (148, 163, 184)
C_DIM = (100, 116, 139)
C_CODE_BG = (13, 17, 23)
C_TERM_BAR = (22, 27, 34)
C_GREEN = (16, 185, 129)
C_BLUE = (59, 130, 246)
C_ORANGE = (245, 158, 11)
C_YELLOW = (250, 204, 21)

# Voices
V_MAIN = "es-ES-AlvaroNeural"
V_FEMALE = "es-ES-ElviraNeural"

# Fonts
F_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
F_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
F_MONO = "/System/Library/Fonts/Supplemental/Courier New.ttf"
F_MONO_B = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"

def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

# Font cache
_fc = {}
def F(path, size):
    k = (path, size)
    if k not in _fc:
        _fc[k] = font(path, size)
    return _fc[k]

# ═══════════════════════════════════════════
# DRAWING UTILITIES
# ═══════════════════════════════════════════

def gradient_bg(draw, c1=C_BG, c2=C_SURFACE):
    """Vertical gradient background"""
    for y in range(H):
        r = int(c1[0] + (c2[0]-c1[0]) * y/H)
        g = int(c1[1] + (c2[1]-c1[1]) * y/H)
        b = int(c1[2] + (c2[2]-c1[2]) * y/H)
        draw.line([(0,y),(W,y)], fill=(r,g,b))

def rounded_rect(draw, xy, fill, r=16, outline=None):
    """Draw rounded rectangle"""
    x1,y1,x2,y2 = xy
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline)

def text_center(draw, y, text, fnt, fill=C_WHITE):
    """Draw centered text"""
    bb = draw.textbbox((0,0), text, font=fnt)
    tw = bb[2]-bb[0]
    draw.text(((W-tw)//2, y), text, font=fnt, fill=fill)

def text_wrapped(draw, x, y, text, fnt, fill=C_WHITE, max_w=800, line_h=None):
    """Draw wrapped text, return final y"""
    if line_h is None:
        line_h = fnt.size + 8
    words = text.split()
    lines = []
    cur = ""
    for w in words:
        test = cur + " " + w if cur else w
        bb = draw.textbbox((0,0), test, font=fnt)
        if bb[2]-bb[0] > max_w and cur:
            lines.append(cur)
            cur = w
        else:
            cur = test
    if cur:
        lines.append(cur)
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_h
    return y

def progress_bar(draw, current, total):
    """Bottom progress bar"""
    bar_h = 4
    bar_y = H - bar_h
    draw.rectangle([(0, bar_y),(W, H)], fill=(30,30,50))
    pw = int(W * current / max(total,1))
    # Gradient bar
    for x in range(pw):
        t = x / max(W,1)
        r = int(C_TEAL[0] + (C_PURPLE[0]-C_TEAL[0])*t)
        g = int(C_TEAL[1] + (C_PURPLE[1]-C_TEAL[1])*t)
        b = int(C_TEAL[2] + (C_PURPLE[2]-C_TEAL[2])*t)
        draw.line([(x, bar_y),(x, H)], fill=(r,g,b))

def chapter_badge(draw, num, title, x=80, y=40):
    """Chapter number badge + title"""
    # Badge circle
    bx, by, br = x+20, y+20, 22
    draw.ellipse([(bx-br, by-br),(bx+br, by+br)], fill=C_TEAL)
    ns = str(num)
    bb = draw.textbbox((0,0), ns, font=F(F_BOLD, 20))
    nw = bb[2]-bb[0]
    draw.text((bx - nw//2, by - 12), ns, font=F(F_BOLD, 20), fill=C_BG)
    # Title
    draw.text((bx + br + 16, by - 12), title, font=F(F_REG, 22), fill=C_MUTED)

def draw_terminal(draw, x, y, w, h, lines):
    """Terminal mockup with colored dots"""
    # Window frame
    rounded_rect(draw, (x, y, x+w, y+h), fill=C_CODE_BG, r=12)
    # Title bar
    rounded_rect(draw, (x, y, x+w, y+36), fill=C_TERM_BAR, r=12)
    draw.rectangle([(x, y+24),(x+w, y+36)], fill=C_TERM_BAR)
    # Dots
    for i, c in enumerate([(255,95,87),(254,188,46),(40,200,64)]):
        cx = x + 18 + i*22
        draw.ellipse([(cx-5, y+13),(cx+5, y+23)], fill=c)
    # Title
    draw.text((x + w//2 - 30, y+10), "Terminal", font=F(F_MONO, 12), fill=C_DIM)
    # Lines
    ly = y + 48
    lh = 22
    for line in lines[:int((h-60)/lh)]:
        if isinstance(line, tuple):
            text, color = line
        else:
            text, color = line, C_LIGHT
        draw.text((x+18, ly), text, font=F(F_MONO, 15), fill=color)
        ly += lh

def draw_widget_mockup(draw, x, y, w=360, h=500, messages=None):
    """Chat widget mockup"""
    # Frame
    rounded_rect(draw, (x, y, x+w, y+h), fill=(25,25,45), r=20, outline=(50,50,80))
    # Header
    rounded_rect(draw, (x, y, x+w, y+56), fill=C_TEAL, r=20)
    draw.rectangle([(x, y+32),(x+w, y+56)], fill=C_TEAL)
    draw.text((x+16, y+16), "Sarah", font=F(F_BOLD, 22), fill=C_WHITE)
    draw.ellipse([(x+w-40, y+18),(x+w-22, y+36)], fill=(200,200,200))
    # Messages
    if messages:
        my = y + 70
        for msg in messages:
            is_bot = msg.get("bot", False)
            text = msg.get("text", "")
            mc = C_TEAL if is_bot else C_PURPLE
            mx = x + 14 if is_bot else x + w - 14
            mw = min(w - 60, len(text) * 8 + 24)
            if is_bot:
                rounded_rect(draw, (mx, my, mx+mw, my+36), fill=mc, r=12)
                draw.text((mx+12, my+9), text[:int(mw/7)], font=F(F_REG, 14), fill=C_WHITE)
            else:
                rounded_rect(draw, (mx-mw, my, mx, my+36), fill=mc, r=12)
                t = text[:int(mw/7)]
                bb = draw.textbbox((0,0), t, font=F(F_REG, 14))
                draw.text((mx-mw+12, my+9), t, font=F(F_REG, 14), fill=C_WHITE)
            my += 48
    # Input bar
    iy = y + h - 52
    rounded_rect(draw, (x+10, iy, x+w-10, iy+40), fill=(35,35,55), r=20)
    draw.text((x+24, iy+10), "Escribe un mensaje...", font=F(F_REG, 14), fill=C_DIM)

def draw_dashboard_mockup(draw, x, y, w=800, h=480, active_tab="queue"):
    """Agent dashboard mockup"""
    rounded_rect(draw, (x, y, x+w, y+h), fill=(18,18,32), r=14, outline=(40,40,65))
    # Sidebar
    sw = 180
    rounded_rect(draw, (x, y, x+sw, y+h), fill=(14,14,28), r=14)
    draw.rectangle([(x+sw-1, y),(x+sw, y+h)], fill=(40,40,65))
    # Logo
    draw.text((x+16, y+20), "Sarah", font=F(F_BOLD, 20), fill=C_TEAL)
    draw.text((x+16, y+44), "Dashboard", font=F(F_REG, 12), fill=C_DIM)
    # Nav items
    tabs = [("Conversaciones","queue"), ("Leads","leads"), ("Analytics","analytics"),
            ("Llamadas","calls"), ("Training","training"), ("Ajustes","settings")]
    ty = y + 80
    for label, tid in tabs:
        bg = (C_TEAL[0]//8, C_TEAL[1]//8, C_TEAL[2]//8) if tid == active_tab else None
        if bg:
            rounded_rect(draw, (x+8, ty-4, x+sw-8, ty+28), fill=bg, r=8)
        color = C_TEAL if tid == active_tab else C_MUTED
        draw.text((x+20, ty), label, font=F(F_REG, 15), fill=color)
        ty += 40
    # Main area header
    draw.text((x+sw+20, y+20), active_tab.capitalize(), font=F(F_BOLD, 24), fill=C_WHITE)
    draw.rectangle([(x+sw+20, y+56),(x+w-20, y+57)], fill=(40,40,65))


def create_slide(idx, total, chapter_num, chapter_title, slide_type, content):
    """Create a single slide image"""
    img = Image.new("RGB", (W, H), C_BG)
    draw = ImageDraw.Draw(img)
    gradient_bg(draw)
    progress_bar(draw, idx+1, total)

    if slide_type == "title":
        # Big centered title
        tag = content.get("tag", "")
        title = content.get("title", "")
        subtitle = content.get("subtitle", "")
        if tag:
            text_center(draw, H//2 - 120, tag, F(F_BOLD, 16), C_TEAL)
        text_center(draw, H//2 - 80, title, F(F_BOLD, 64), C_WHITE)
        if subtitle:
            text_center(draw, H//2 + 10, subtitle, F(F_REG, 28), C_MUTED)

    elif slide_type == "chapter":
        num = content.get("num", 1)
        title = content.get("title", "")
        sub = content.get("subtitle", "")
        # Big number
        ns = f"{num:02d}"
        text_center(draw, H//2 - 140, ns, F(F_BOLD, 140), C_TEAL)
        text_center(draw, H//2 + 40, title, F(F_BOLD, 48), C_WHITE)
        if sub:
            text_center(draw, H//2 + 110, sub, F(F_REG, 24), C_MUTED)

    elif slide_type == "bullets":
        chapter_badge(draw, chapter_num, chapter_title)
        title = content.get("title", "")
        items = content.get("items", [])
        draw.text((80, 100), title, font=F(F_BOLD, 44), fill=C_WHITE)
        by = 180
        for item in items:
            # Bullet dot
            draw.ellipse([(92, by+10),(102, by+20)], fill=C_TEAL)
            text_wrapped(draw, 120, by, item, F(F_REG, 24), C_LIGHT, max_w=1680, line_h=34)
            by += 60

    elif slide_type == "code":
        chapter_badge(draw, chapter_num, chapter_title)
        title = content.get("title", "")
        code = content.get("code", [])
        desc = content.get("desc", "")
        draw.text((80, 100), title, font=F(F_BOLD, 40), fill=C_WHITE)
        if desc:
            draw.text((80, 155), desc, font=F(F_REG, 20), fill=C_MUTED)
        # Terminal
        ty = 200 if desc else 170
        th = min(H - ty - 40, len(code)*24 + 70)
        draw_terminal(draw, 80, ty, W-160, th, code)

    elif slide_type == "split":
        chapter_badge(draw, chapter_num, chapter_title)
        title = content.get("title", "")
        text = content.get("text", "")
        items = content.get("items", [])
        visual = content.get("visual", "widget")
        draw.text((80, 100), title, font=F(F_BOLD, 40), fill=C_WHITE)
        # Left text
        ly = 170
        if text:
            ly = text_wrapped(draw, 80, ly, text, F(F_REG, 22), C_LIGHT, max_w=800, line_h=36)
            ly += 20
        for item in items:
            draw.ellipse([(92, ly+8),(104, ly+20)], fill=C_TEAL)
            ly = text_wrapped(draw, 120, ly, item, F(F_REG, 22), C_LIGHT, max_w=760, line_h=32)
            ly += 16
        # Right visual
        if visual == "widget":
            msgs = content.get("messages", [])
            draw_widget_mockup(draw, W-460, 140, 360, 520, msgs)
        elif visual == "dashboard":
            tab = content.get("tab", "queue")
            draw_dashboard_mockup(draw, 960, 140, 880, 520, tab)
        elif visual == "terminal":
            tlines = content.get("terminal_lines", [])
            draw_terminal(draw, 960, 140, 880, 520, tlines)

    elif slide_type == "grid":
        chapter_badge(draw, chapter_num, chapter_title)
        title = content.get("title", "")
        items = content.get("items", [])
        draw.text((80, 100), title, font=F(F_BOLD, 44), fill=C_WHITE)
        cols = content.get("cols", 2)
        gx, gy = 80, 180
        cw = (W - 160 - (cols-1)*24) // cols
        ch = 140
        for i, item in enumerate(items):
            col = i % cols
            row = i // cols
            ix = gx + col * (cw + 24)
            iy = gy + row * (ch + 20)
            rounded_rect(draw, (ix, iy, ix+cw, iy+ch), fill=(20,22,40), r=14, outline=(40,42,65))
            icon = item.get("icon", "●")
            label = item.get("label", "")
            desc = item.get("desc", "")
            color = item.get("color", C_TEAL)
            draw.text((ix+20, iy+16), icon, font=F(F_BOLD, 28), fill=color)
            draw.text((ix+20, iy+54), label, font=F(F_BOLD, 20), fill=C_WHITE)
            text_wrapped(draw, ix+20, iy+82, desc, F(F_REG, 14), C_MUTED, max_w=cw-40, line_h=20)

    elif slide_type == "diagram":
        chapter_badge(draw, chapter_num, chapter_title)
        title = content.get("title", "")
        boxes = content.get("boxes", [])
        arrows = content.get("arrows", [])
        draw.text((80, 100), title, font=F(F_BOLD, 44), fill=C_WHITE)
        box_map = {}
        for box in boxes:
            bx, by = box["x"], box["y"]
            bw, bh = box.get("w", 200), box.get("h", 80)
            bc = box.get("color", C_TEAL)
            rounded_rect(draw, (bx, by, bx+bw, by+bh), fill=(bc[0]//4, bc[1]//4, bc[2]//4), r=12, outline=bc)
            text_center_xy(draw, bx, by, bw, bh, box["label"], F(F_BOLD, 18), C_WHITE)
            box_map[box.get("id", "")] = (bx, by, bw, bh)
        for arrow in arrows:
            fx, fy = arrow["from"]
            tx, ty = arrow["to"]
            draw.line([(fx,fy),(tx,ty)], fill=C_DIM, width=2)

    elif slide_type == "quote":
        text = content.get("text", "")
        author = content.get("author", "")
        # Big centered quote
        draw.text((W//2 - 20, H//2 - 100), '"', font=F(F_BOLD, 120), fill=C_TEAL)
        text_wrapped(draw, 160, H//2 - 40, text, F(F_REG, 32), C_WHITE, max_w=1600, line_h=48)
        if author:
            text_center(draw, H//2 + 120, f"— {author}", F(F_REG, 22), C_MUTED)

    return img


def text_center_xy(draw, x, y, w, h, text, fnt, fill):
    """Center text in a box"""
    bb = draw.textbbox((0,0), text, font=fnt)
    tw, th = bb[2]-bb[0], bb[3]-bb[1]
    draw.text((x + (w-tw)//2, y + (h-th)//2), text, font=fnt, fill=fill)


# ═══════════════════════════════════════════
# SLIDES DATA — imported from scenes file
# ═══════════════════════════════════════════
# Will be loaded from slides_data.py
def load_slides():
    from slides_data import SLIDES
    return SLIDES


# ═══════════════════════════════════════════
# AUDIO GENERATION (edge-tts)
# ═══════════════════════════════════════════
async def generate_audio(text, filepath, voice=V_MAIN, rate="-2%"):
    """Generate audio with Microsoft Edge TTS"""
    import edge_tts
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(str(filepath))
    return filepath

async def generate_all_audio(slides):
    """Generate audio for all slides"""
    tasks = []
    for i, s in enumerate(slides):
        fp = AUD / f"slide_{i:03d}.mp3"
        if fp.exists():
            print(f"  [skip] Audio {i:03d} ya existe")
            continue
        voice = s.get("voice", V_MAIN)
        rate = s.get("rate", "-2%")
        narration = s.get("narration", "")
        if not narration:
            continue
        tasks.append((i, narration, fp, voice, rate))

    # Process in batches of 5 to avoid rate limits
    batch_size = 5
    for batch_start in range(0, len(tasks), batch_size):
        batch = tasks[batch_start:batch_start+batch_size]
        coros = [generate_audio(text, fp, voice, rate) for _, text, fp, voice, rate in batch]
        await asyncio.gather(*coros)
        for idx, _, fp, _, _ in batch:
            print(f"  [audio] Slide {idx:03d} → {fp.name}")


# ═══════════════════════════════════════════
# AUDIO DURATION
# ═══════════════════════════════════════════
def get_duration(filepath):
    """Get audio duration in seconds using ffprobe"""
    cmd = ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
           "-of", "csv=p=0", str(filepath)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(result.stdout.strip())
    except:
        return 10.0  # fallback


# ═══════════════════════════════════════════
# VIDEO COMPOSITION
# ═══════════════════════════════════════════
def create_segment(slide_img_path, audio_path, output_path, duration=None):
    """Create video segment from image + audio with Ken Burns effect"""
    if duration is None:
        duration = get_duration(audio_path)

    # Add 0.5s padding
    duration += 0.5
    frames = int(duration * FPS)

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(slide_img_path),
        "-i", str(audio_path),
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-vf", f"zoompan=z='min(zoom+0.0002,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},format=yuv420p",
        "-t", str(duration),
        "-shortest",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True)

def create_silent_segment(slide_img_path, output_path, duration=3.0):
    """Create silent video segment (for title cards)"""
    frames = int(duration * FPS)
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(slide_img_path),
        "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo",
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac",
        "-vf", f"zoompan=z='min(zoom+0.0003,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},format=yuv420p",
        "-t", str(duration),
        "-shortest",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True)

def normalize_segment(input_path, output_path):
    """Re-encode segment to consistent format for concat"""
    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-c:v", "libx264", "-crf", "23", "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True)

def concat_segments(segment_paths, output_path):
    """Concatenate all segments - normalize first, then concat"""
    norm_dir = OUT / "normalized"
    norm_dir.mkdir(exist_ok=True)

    # Step 1: Normalize all segments to identical format
    print("  Normalizando segmentos...")
    norm_paths = []
    for i, p in enumerate(segment_paths):
        np = norm_dir / f"norm_{i:03d}.ts"
        if not np.exists():
            # Convert to MPEG-TS for seamless concat
            cmd = [
                "ffmpeg", "-y", "-i", str(p),
                "-c:v", "libx264", "-crf", "23", "-preset", "fast",
                "-pix_fmt", "yuv420p", "-r", str(FPS),
                "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
                "-bsf:v", "h264_mp4toannexb",
                "-f", "mpegts",
                str(np)
            ]
            subprocess.run(cmd, capture_output=True)
        norm_paths.append(np)
        if (i+1) % 10 == 0:
            print(f"    {i+1}/{len(segment_paths)} normalizados")
    print(f"    {len(segment_paths)}/{len(segment_paths)} normalizados")

    # Step 2: Concat using pipe protocol (most reliable)
    print("  Concatenando...")
    inputs = "|".join(str(p) for p in norm_paths)
    cmd = [
        "ffmpeg", "-y",
        "-i", f"concat:{inputs}",
        "-c:v", "libx264", "-crf", "20", "-preset", "medium",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart",
        str(output_path)
    ]
    subprocess.run(cmd)
    print(f"\n✅ Video final: {output_path}")
    if output_path.exists():
        print(f"   Tamaño: {output_path.stat().st_size / 1024 / 1024:.1f} MB")


# ═══════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════
def main():
    print("=" * 60)
    print("  SARAH — Generador de Video Demo Profesional")
    print("=" * 60)

    # Create dirs
    for d in [OUT, AUD, FRM, SEG]:
        d.mkdir(parents=True, exist_ok=True)

    # Load slides
    print("\n📋 Cargando slides...")
    slides = load_slides()
    total = len(slides)
    print(f"   {total} slides definidos")

    # Generate frames
    print("\n🎨 Generando frames...")
    for i, s in enumerate(slides):
        fp = FRM / f"slide_{i:03d}.png"
        if fp.exists():
            print(f"  [skip] Frame {i:03d}")
            continue
        img = create_slide(
            idx=i, total=total,
            chapter_num=s.get("chapter_num", 0),
            chapter_title=s.get("chapter_title", ""),
            slide_type=s.get("type", "title"),
            content=s.get("content", {})
        )
        img.save(fp, "PNG")
        print(f"  [frame] Slide {i:03d} → {fp.name}")

    # Generate audio
    print("\n🎙️  Generando narración (Edge TTS)...")
    asyncio.run(generate_all_audio(slides))

    # Create video segments
    print("\n🎬 Creando segmentos de video...")
    segment_paths = []
    for i, s in enumerate(slides):
        seg_fp = SEG / f"seg_{i:03d}.mp4"
        frame_fp = FRM / f"slide_{i:03d}.png"
        audio_fp = AUD / f"slide_{i:03d}.mp3"

        if seg_fp.exists():
            print(f"  [skip] Segmento {i:03d}")
            segment_paths.append(seg_fp)
            continue

        if audio_fp.exists():
            create_segment(frame_fp, audio_fp, seg_fp)
            print(f"  [video] Segmento {i:03d} → {seg_fp.name}")
        else:
            # Silent segment (title cards)
            dur = s.get("duration", 4.0)
            create_silent_segment(frame_fp, seg_fp, dur)
            print(f"  [video] Segmento silencioso {i:03d} ({dur}s)")
        segment_paths.append(seg_fp)

    # Concatenate
    print("\n🔗 Concatenando segmentos...")
    concat_segments(segment_paths, FINAL)

    # Duration
    dur = get_duration(FINAL)
    mins = int(dur // 60)
    secs = int(dur % 60)
    print(f"   Duración: {mins}:{secs:02d}")
    print("\n🎉 ¡Video generado con éxito!")

if __name__ == "__main__":
    main()
