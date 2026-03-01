#!/usr/bin/env python3
"""Send the narrated video via email."""
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "jorge.vazquez@redegal.com"
SMTP_PASS = "fnhn lruh jsiw xvua"
TO_EMAIL = "jorge.vazquez@redegal.com"
SUBJECT = "Sarah — Video Presentacion Narrado (17 min)"
VIDEO_PATH = "/Users/jorgevazquez/sarah/docs/Sarah-Video-Narrado.mp4"

body = """Hola Jorge,

Adjunto el video de presentacion narrado de Sarah, el chatbot IA premium con voz integrada.

El video contiene:
- 93 slides con diseno corporativo Redegal (fondo oscuro, colores marca)
- Narracion profesional en espanol (voz es-ES-ElviraNeural de Microsoft)
- Duracion aproximada: 17 minutos
- 8 secciones: Introduccion, Instalacion, Configuracion, Chatbot Usuario, SarahPhone VoIP, Dashboard, Integraciones, Cierre

Contenido cubierto:
1. Que es Sarah: chatbot IA + VoIP + Dashboard
2. Stack tecnologico: Node.js 20, React 19, PostgreSQL 16, Redis 7, Janus WebRTC
3. Instalacion con Docker Compose (un comando)
4. Configuracion completa: branding, idiomas, IA multi-proveedor, CRM, webhooks
5. Experiencia del usuario: widget, chat, quick replies, cards, modo oscuro
6. SarahPhone: Click to Call via WebRTC + SIP, grabacion, transcripcion
7. Dashboard: conversaciones, leads, analytics, wallboard, entrenamiento IA
8. Integraciones: Salesforce, HubSpot, WordPress, Shopify, Magento

Archivo: Sarah-Video-Narrado.mp4
Ubicacion: /Users/jorgevazquez/sarah/docs/Sarah-Video-Narrado.mp4

Saludos,
Script automatizado
"""

msg = MIMEMultipart()
msg["From"] = SMTP_USER
msg["To"] = TO_EMAIL
msg["Subject"] = SUBJECT
msg.attach(MIMEText(body, "plain"))

# Attach video (16.4 MB < 25 MB)
file_size = os.path.getsize(VIDEO_PATH) / (1024 * 1024)
print(f"Video size: {file_size:.1f} MB")

if file_size <= 25:
    print("Attaching video to email...")
    with open(VIDEO_PATH, "rb") as f:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(f.read())
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f'attachment; filename="Sarah-Video-Narrado.mp4"')
    msg.attach(part)
    print("Video attached.")
else:
    msg.attach(MIMEText(f"\n\nEl video pesa {file_size:.1f} MB (> 25 MB), no se adjunta.\nRuta: {VIDEO_PATH}\n", "plain"))
    print("Video too large, not attaching.")

print("Sending email...")
with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
    server.starttls()
    server.login(SMTP_USER, SMTP_PASS)
    server.sendmail(SMTP_USER, TO_EMAIL, msg.as_string())

print("Email sent successfully!")
