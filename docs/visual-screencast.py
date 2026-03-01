#!/usr/bin/env python3
"""
Sarah — Visual Screencast Video Generator
Captures real screenshots from the demo page, narrates with edge-tts,
and compiles into a professional MP4 video.
"""

import os
import sys
import time
import json
import asyncio
import subprocess
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

# ── Paths ──
BASE_DIR = Path(__file__).parent
TEMP_DIR = BASE_DIR / "screencast-temp"
OUTPUT = BASE_DIR / "Sarah-Demo-Visual.mp4"
DEMO_URL = "http://localhost:8877/demo/video-demo.html"
FFMPEG = "/opt/homebrew/bin/ffmpeg"
FFPROBE = "/opt/homebrew/bin/ffprobe"
TTS_VOICE = "es-ES-ElviraNeural"

# ── Scene definitions ──
SCENES = [
    {
        "id": "01_website",
        "narration": "Así es la web corporativa de Redegal. En la esquina inferior derecha podemos ver el botón del chatbot Sarah, con una sutil animación que invita al visitante a interactuar.",
        "setup_js": """
            // Hide start overlay, ensure clean state
            document.getElementById('start-overlay').style.display = 'none';
            document.getElementById('widget-panel').classList.remove('open');
            document.getElementById('dashboard-overlay').style.display = 'none';
            document.getElementById('redegal-site').style.display = 'block';
            document.getElementById('widget-container').style.display = 'block';
            document.getElementById('redegal-site').scrollTop = 0;
        """
    },
    {
        "id": "02_fab_highlight",
        "narration": "Cuando el visitante hace clic en el botón, se abre el widget de Sarah.",
        "setup_js": """
            // Add a visual highlight ring around FAB
            const fab = document.getElementById('fab');
            fab.style.boxShadow = '0 0 0 8px rgba(227,6,19,0.3), 0 0 0 16px rgba(227,6,19,0.15), 0 4px 24px rgba(227,6,19,0.4)';
            fab.style.transform = 'scale(1.1)';
        """
    },
    {
        "id": "03_welcome_view",
        "narration": "La vista de bienvenida muestra un saludo personalizado y cuatro líneas de negocio: SEO y Growth, Business Intelligence, Marketing Digital y Desarrollo Tech. El visitante elige el tema que le interesa.",
        "setup_js": """
            // Open widget panel with welcome view
            const fab = document.getElementById('fab');
            fab.style.boxShadow = '';
            fab.style.transform = '';
            const panel = document.getElementById('widget-panel');
            panel.classList.add('open');
            document.getElementById('welcome-view').style.display = 'flex';
            document.getElementById('chat-view').style.display = 'none';
            document.getElementById('call-panel').style.display = 'none';
        """
    },
    {
        "id": "04_boostic_selected",
        "narration": "Al seleccionar Boostic, el sistema sabe que el visitante necesita ayuda con posicionamiento web y optimización de búsquedas.",
        "setup_js": """
            // Highlight Boostic item
            const boostic = document.querySelector('[data-line="boostic"]');
            boostic.classList.add('selected');
            boostic.style.borderColor = '#E30613';
            boostic.style.background = 'rgba(227,6,19,0.08)';
            boostic.style.transform = 'scale(1.05)';
            boostic.style.boxShadow = '0 4px 16px rgba(227,6,19,0.15)';
        """
    },
    {
        "id": "05_chat_messages",
        "narration": "La conversación comienza de forma natural. Sarah responde con información precisa sobre los servicios de Boostic, mencionando casos reales como Lacoste o Adolfo Domínguez, porque tiene acceso a la base de conocimiento completa de la empresa.",
        "setup_js": """
            // Switch to chat view with messages
            document.getElementById('welcome-view').style.display = 'none';
            document.getElementById('chat-view').style.display = 'flex';
            document.getElementById('call-panel').style.display = 'none';
            const cm = document.getElementById('chat-messages');
            cm.innerHTML = `
                <div class="msg msg-bot" style="animation:none">
                    <div class="avatar" style="width:28px;height:28px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#E30613,#B8050F);display:flex;align-items:center;justify-content:center;color:white;font-size:12px">✦</div>
                    <div class="bubble" style="background:#fff;color:#0F172A;border:1px solid #E2E8F0;padding:10px 14px;border-radius:18px 18px 18px 6px;font-size:13px;line-height:1.5">¡Hola! Soy Sarah, tu asistente virtual de Redegal. ¿En qué puedo ayudarte con SEO y Growth?</div>
                </div>
                <div class="msg-time" style="font-size:9px;color:#94A3B8;margin-top:2px">10:30</div>
                <div class="msg msg-user" style="align-self:flex-end;animation:none">
                    <div class="bubble" style="background:linear-gradient(135deg,#E30613,#B8050F);color:white;padding:10px 14px;border-radius:18px 18px 6px 18px;font-size:13px;line-height:1.5;box-shadow:0 2px 8px rgba(227,6,19,0.2)">Necesito mejorar el posicionamiento de mi ecommerce</div>
                </div>
                <div class="msg-time right" style="font-size:9px;color:#94A3B8;margin-top:2px;text-align:right">10:31 ✓✓</div>
                <div class="msg msg-bot" style="animation:none">
                    <div class="avatar" style="width:28px;height:28px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#E30613,#B8050F);display:flex;align-items:center;justify-content:center;color:white;font-size:12px">✦</div>
                    <div class="bubble" style="background:#fff;color:#0F172A;border:1px solid #E2E8F0;padding:10px 14px;border-radius:18px 18px 18px 6px;font-size:13px;line-height:1.5">¡Perfecto! Nuestro servicio <strong>Boostic</strong> está especializado en SEO para ecommerce. Hemos ayudado a marcas como <strong>Lacoste</strong> y <strong>Adolfo Domínguez</strong> a incrementar su tráfico orgánico en más de un 200%. ¿Te gustaría que te explique nuestro proceso?</div>
                </div>
                <div class="msg-time" style="font-size:9px;color:#94A3B8;margin-top:2px">10:31</div>
            `;
        """
    },
    {
        "id": "06_quick_replies",
        "narration": "El visitante muestra interés y Sarah ofrece opciones rápidas: más información, ver casos de éxito, solicitar presupuesto o hablar directamente con un experto.",
        "setup_js": """
            const cm = document.getElementById('chat-messages');
            cm.innerHTML += `
                <div class="msg msg-user" style="align-self:flex-end;animation:none">
                    <div class="bubble" style="background:linear-gradient(135deg,#E30613,#B8050F);color:white;padding:10px 14px;border-radius:18px 18px 6px 18px;font-size:13px;line-height:1.5;box-shadow:0 2px 8px rgba(227,6,19,0.2)">Sí, me interesa mucho</div>
                </div>
                <div class="msg-time right" style="font-size:9px;color:#94A3B8;margin-top:2px;text-align:right">10:32 ✓✓</div>
                <div class="msg msg-bot" style="animation:none">
                    <div class="avatar" style="width:28px;height:28px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#E30613,#B8050F);display:flex;align-items:center;justify-content:center;color:white;font-size:12px">✦</div>
                    <div class="bubble" style="background:#fff;color:#0F172A;border:1px solid #E2E8F0;padding:10px 14px;border-radius:18px 18px 18px 6px;font-size:13px;line-height:1.5">Nuestro proceso incluye una <strong>auditoría SEO técnica</strong> completa, optimización de contenidos con IA, y una estrategia de link building. Los resultados típicos son un incremento del <strong>150-300%</strong> en tráfico orgánico en 6 meses.</div>
                </div>
                <div class="msg-time" style="font-size:9px;color:#94A3B8;margin-top:2px">10:32</div>
                <div class="qr-row" style="display:flex;gap:6px;flex-wrap:wrap;padding:4px 0;align-self:flex-start">
                    <span class="qr-chip" style="font-size:12px;font-weight:600;padding:7px 14px;border-radius:20px;border:1.5px solid #E30613;color:#E30613;background:rgba(227,6,19,0.04);cursor:pointer">Más información</span>
                    <span class="qr-chip" style="font-size:12px;font-weight:600;padding:7px 14px;border-radius:20px;border:1.5px solid #E30613;color:#E30613;background:rgba(227,6,19,0.04);cursor:pointer">Ver casos de éxito</span>
                    <span class="qr-chip" style="font-size:12px;font-weight:600;padding:7px 14px;border-radius:20px;border:1.5px solid #E30613;color:#E30613;background:rgba(227,6,19,0.04);cursor:pointer">Solicitar presupuesto</span>
                    <span class="qr-chip" style="font-size:12px;font-weight:600;padding:7px 14px;border-radius:20px;border:1.5px solid #E30613;color:#E30613;background:rgba(227,6,19,0.04);cursor:pointer">Hablar con un experto</span>
                </div>
            `;
            cm.scrollTop = cm.scrollHeight;
        """
    },
    {
        "id": "07_escalation",
        "narration": "Cuando el visitante pide hablar con una persona, Sarah gestiona la escalación automáticamente. Un agente del equipo de Boostic se conecta y ve todo el contexto previo de la conversación.",
        "setup_js": """
            const cm = document.getElementById('chat-messages');
            // Remove quick replies
            const qr = cm.querySelector('.qr-row');
            if (qr) qr.remove();
            cm.innerHTML += `
                <div class="msg msg-user" style="align-self:flex-end;animation:none">
                    <div class="bubble" style="background:linear-gradient(135deg,#E30613,#B8050F);color:white;padding:10px 14px;border-radius:18px 18px 6px 18px;font-size:13px;line-height:1.5;box-shadow:0 2px 8px rgba(227,6,19,0.2)">Me gustaría hablar con un experto</div>
                </div>
                <div class="msg-time right" style="font-size:9px;color:#94A3B8;margin-top:2px;text-align:right">10:33 ✓✓</div>
                <div class="msg msg-system" style="align-self:center;font-size:11px;color:#64748B;background:#fff;padding:5px 14px;border-radius:24px;border:1px solid #E2E8F0;animation:none">Conectando con un agente de Boostic...</div>
                <div class="msg msg-bot" style="animation:none">
                    <div class="avatar" style="width:28px;height:28px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#E30613,#B8050F);display:flex;align-items:center;justify-content:center;color:white;font-size:12px">✦</div>
                    <div class="bubble" style="background:#fff;color:#0F172A;border:1px solid #E2E8F0;padding:10px 14px;border-radius:18px 18px 18px 6px;font-size:13px;line-height:1.5">Te conecto ahora mismo con un especialista de nuestro equipo de SEO. Un momento, por favor.</div>
                </div>
                <div class="msg-time" style="font-size:9px;color:#94A3B8;margin-top:2px">10:33</div>
                <div class="msg msg-system" style="align-self:center;font-size:11px;color:#10B981;background:rgba(16,185,129,0.05);padding:5px 14px;border-radius:24px;border:1px solid rgba(16,185,129,0.2);animation:none">✅ Ana García se ha unido a la conversación</div>
                <div class="msg msg-bot" style="animation:none">
                    <div class="avatar" style="width:28px;height:28px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#10B981,#059669);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:700">AG</div>
                    <div class="bubble" style="background:#fff;color:#0F172A;border:1px solid #E2E8F0;padding:10px 14px;border-radius:18px 18px 18px 6px;font-size:13px;line-height:1.5">¡Hola! Soy Ana, especialista SEO en Boostic. He visto tu conversación con Sarah. ¿Tienes un ecommerce que quieres posicionar?</div>
                </div>
                <div class="msg-time" style="font-size:9px;color:#94A3B8;margin-top:2px">10:34</div>
            `;
            cm.scrollTop = cm.scrollHeight;
        """
    },
    {
        "id": "08_call_button",
        "narration": "Además del chat, el visitante tiene la opción de llamar directamente. El botón de teléfono en la cabecera del widget activa la función Click to Call.",
        "setup_js": """
            // Highlight call button in header
            const callBtn = document.getElementById('w-call-btn');
            callBtn.style.background = 'rgba(16,185,129,0.5)';
            callBtn.style.boxShadow = '0 0 0 4px rgba(16,185,129,0.3), 0 0 0 8px rgba(16,185,129,0.15)';
            callBtn.style.transform = 'scale(1.3)';
            callBtn.style.borderRadius = '8px';
            callBtn.style.transition = 'all 0.3s';
        """
    },
    {
        "id": "09_call_connecting",
        "narration": "Al pulsar llamar, el widget cambia a la vista de llamada. Se muestra el departamento al que se llama, el estado de conexión y los controles de audio.",
        "setup_js": """
            // Reset call button
            const callBtn = document.getElementById('w-call-btn');
            callBtn.style.background = '';
            callBtn.style.boxShadow = '';
            callBtn.style.transform = '';
            // Show call panel
            document.getElementById('chat-view').style.display = 'none';
            document.getElementById('welcome-view').style.display = 'none';
            document.getElementById('call-panel').style.display = 'flex';
            document.getElementById('cp-status-text').textContent = 'Llamando...';
            document.getElementById('cp-status-text').style.color = 'rgba(255,255,255,0.7)';
            document.getElementById('cp-dot').style.background = '#F59E0B';
            document.getElementById('cp-timer').textContent = '00:00';
            document.getElementById('cp-quality').style.display = 'none';
            document.getElementById('cp-encrypted').style.display = 'none';
        """
    },
    {
        "id": "10_call_connected",
        "narration": "Una vez conectada la llamada, el visitante ve el tiempo transcurrido, el indicador de calidad de audio y la confirmación de que la llamada está cifrada con SRTP. Todo funciona directamente desde el navegador, sin necesidad de instalar nada.",
        "setup_js": """
            document.getElementById('cp-status-text').textContent = 'Conectado';
            document.getElementById('cp-status-text').style.color = '#34D399';
            document.getElementById('cp-dot').style.background = '#10B981';
            document.getElementById('cp-timer').textContent = '00:45';
            document.getElementById('cp-quality').style.display = 'flex';
            document.getElementById('cp-encrypted').style.display = 'flex';
        """
    },
    {
        "id": "11_dashboard",
        "narration": "Pasemos al otro lado: el Dashboard de agentes. Aquí la operadora Ana García ve las tres conversaciones activas en su cola, ordenadas por prioridad y tiempo de espera.",
        "setup_js": """
            // Show dashboard, hide site and widget
            document.getElementById('dashboard-overlay').style.display = 'flex';
            document.getElementById('redegal-site').style.display = 'none';
            document.getElementById('widget-container').style.display = 'none';
            // Populate conversations
            document.getElementById('do-conv-list').innerHTML = `
                <div class="do-conv active" style="background:rgba(255,255,255,0.05)">
                    <div class="do-avatar" style="background:linear-gradient(135deg,#3B82F6,#1D4ED8);width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0">ML</div>
                    <div class="do-info" style="flex:1;min-width:0">
                        <div class="do-name" style="font-size:12px;font-weight:600;color:#E2E8F0">María López</div>
                        <div class="do-preview" style="font-size:11px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Necesito mejorar mi SEO...</div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
                        <div class="do-time" style="font-size:10px;color:#64748B">10:34</div>
                        <div style="background:#E30613;color:white;font-size:10px;font-weight:600;padding:2px 8px;border-radius:6px">2</div>
                    </div>
                </div>
                <div class="do-conv">
                    <div class="do-avatar" style="background:linear-gradient(135deg,#10B981,#059669);width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0">CR</div>
                    <div class="do-info" style="flex:1;min-width:0">
                        <div class="do-name" style="font-size:12px;font-weight:600;color:#E2E8F0">Carlos Ruiz</div>
                        <div class="do-preview" style="font-size:11px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Consulta sobre Business Intelligence</div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
                        <div class="do-time" style="font-size:10px;color:#64748B">10:28</div>
                        <div style="background:#F59E0B;color:white;font-size:10px;font-weight:600;padding:2px 8px;border-radius:6px">1</div>
                    </div>
                </div>
                <div class="do-conv">
                    <div class="do-avatar" style="background:linear-gradient(135deg,#F59E0B,#D97706);width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0">PS</div>
                    <div class="do-info" style="flex:1;min-width:0">
                        <div class="do-name" style="font-size:12px;font-weight:600;color:#E2E8F0">Patricia Sanz</div>
                        <div class="do-preview" style="font-size:11px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">¿Hacéis campañas en TikTok?</div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
                        <div class="do-time" style="font-size:10px;color:#64748B">10:15</div>
                    </div>
                </div>
            `;
        """
    },
    {
        "id": "12_dashboard_chat",
        "narration": "Al abrir la conversación de María López, Ana ve el historial completo: los mensajes del visitante, las respuestas de Sarah y el momento exacto en que se solicitó la escalación. Puede responder directamente desde aquí.",
        "setup_js": """
            document.getElementById('do-messages').innerHTML = `
                <div class="do-msg visitor" style="align-self:flex-start;display:flex;gap:8px;align-items:flex-end;animation:none">
                    <div class="do-msg-avatar" style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;background:rgba(255,255,255,0.08);color:#94A3B8">V</div>
                    <div class="do-msg-bubble" style="padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;max-width:70%;background:rgba(255,255,255,0.06);color:#E2E8F0">Necesito mejorar el posicionamiento de mi ecommerce</div>
                </div>
                <div style="font-size:9px;color:#475569;margin-left:32px;margin-top:2px">10:31</div>
                <div class="do-msg visitor" style="align-self:flex-start;display:flex;gap:8px;align-items:flex-end;animation:none;margin-top:8px">
                    <div class="do-msg-avatar" style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;background:rgba(139,92,246,0.15);color:#8B5CF6">IA</div>
                    <div style="display:flex;flex-direction:column;max-width:70%">
                        <div style="font-size:10px;font-weight:600;color:#8B5CF6;margin-bottom:2px">Sarah (Bot IA)</div>
                        <div class="do-msg-bubble" style="padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;background:rgba(139,92,246,0.08);color:#E2E8F0;border:1px solid rgba(139,92,246,0.15)">Nuestro servicio Boostic está especializado en SEO para ecommerce. Hemos ayudado a marcas como Lacoste y Adolfo Domínguez a incrementar su tráfico orgánico en más de un 200%.</div>
                    </div>
                </div>
                <div style="font-size:9px;color:#475569;margin-left:32px;margin-top:2px">10:31</div>
                <div class="do-msg visitor" style="align-self:flex-start;display:flex;gap:8px;align-items:flex-end;animation:none;margin-top:8px">
                    <div class="do-msg-avatar" style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;background:rgba(255,255,255,0.08);color:#94A3B8">V</div>
                    <div class="do-msg-bubble" style="padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;max-width:70%;background:rgba(255,255,255,0.06);color:#E2E8F0">Me gustaría hablar con un experto</div>
                </div>
                <div style="font-size:9px;color:#475569;margin-left:32px;margin-top:2px">10:33</div>
                <div class="do-msg-note" style="text-align:center;align-self:center;font-size:10px;padding:4px 14px;border-radius:8px;background:rgba(245,158,11,0.1);color:#F59E0B;border:1px solid rgba(245,158,11,0.2);animation:none;margin-top:8px">⚡ Visitante solicita agente humano</div>
                <div class="do-msg agent" style="align-self:flex-end;display:flex;gap:8px;align-items:flex-end;flex-direction:row-reverse;animation:none;margin-top:8px">
                    <div class="do-msg-avatar" style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;background:#E30613;color:white">AG</div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:70%">
                        <div style="font-size:10px;font-weight:600;color:#E30613;margin-bottom:2px">Ana García</div>
                        <div class="do-msg-bubble" style="padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;background:#E30613;color:white">¡Hola! Soy Ana, especialista SEO en Boostic. He visto tu conversación con Sarah. ¿Tienes un ecommerce que quieres posicionar?</div>
                    </div>
                </div>
                <div style="font-size:9px;color:#475569;text-align:right;margin-right:32px;margin-top:2px">10:34</div>
                <div class="do-msg visitor" style="align-self:flex-start;display:flex;gap:8px;align-items:flex-end;animation:none;margin-top:8px">
                    <div class="do-msg-avatar" style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;background:rgba(255,255,255,0.08);color:#94A3B8">V</div>
                    <div class="do-msg-bubble" style="padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;max-width:70%;background:rgba(255,255,255,0.06);color:#E2E8F0">Sí, es una tienda de moda con Shopify. Tenemos unas 500 visitas al día pero queremos escalar a 2000.</div>
                </div>
                <div style="font-size:9px;color:#475569;margin-left:32px;margin-top:2px">10:35</div>
            `;
            document.getElementById('do-messages').scrollTop = document.getElementById('do-messages').scrollHeight;
        """
    },
    {
        "id": "13_ai_summary",
        "narration": "La inteligencia artificial genera automáticamente un resumen de la conversación: identifica que es un lead cualificado, su objetivo y la recomendación de servicio. Esto ahorra minutos de lectura al agente.",
        "setup_js": """
            document.getElementById('ai-summary').style.display = 'flex';
            document.getElementById('ai-summary-text').innerHTML = 'Lead cualificado interesado en <strong>SEO para ecommerce Shopify</strong>. Objetivo: escalar de 500 a 2000 visitas/día. Sector: moda. Recomendación: <strong>auditoría SEO + estrategia Boostic</strong>. Score: 85/100.';
        """
    },
    {
        "id": "14_final",
        "narration": "Y así es como Sarah transforma la experiencia digital: desde la primera interacción del visitante en la web, pasando por la atención automatizada con IA, la escalación a agentes humanos y las llamadas de voz, todo integrado en un único sistema. Sarah, chatbot inteligente con voz, de Redegal.",
        "setup_js": """
            // Back to website with widget closed
            document.getElementById('dashboard-overlay').style.display = 'none';
            document.getElementById('redegal-site').style.display = 'block';
            document.getElementById('widget-container').style.display = 'block';
            document.getElementById('widget-panel').classList.remove('open');
            document.getElementById('start-overlay').style.display = 'none';
            // Scroll to show the full hero
            document.getElementById('redegal-site').scrollTop = 0;
        """
    },
]


async def generate_tts(text: str, output_path: str):
    """Generate TTS audio using edge-tts."""
    import edge_tts
    communicate = edge_tts.Communicate(text, TTS_VOICE, rate="-5%")
    await communicate.save(output_path)


def get_audio_duration(path: str) -> float:
    """Get audio duration in seconds using ffprobe."""
    result = subprocess.run(
        [FFPROBE, "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True
    )
    return float(result.stdout.strip())


def capture_screenshots():
    """Capture screenshots for all scenes using Playwright."""
    from playwright.sync_api import sync_playwright

    screenshots_dir = TEMP_DIR / "screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
        )
        page = context.new_page()
        page.goto(DEMO_URL, wait_until="networkidle")
        time.sleep(1)

        # Hide start overlay initially
        page.evaluate("document.getElementById('start-overlay').style.display = 'none'")
        time.sleep(0.3)

        for i, scene in enumerate(SCENES):
            print(f"  Capturing scene {i+1}/{len(SCENES)}: {scene['id']}")
            page.evaluate(scene["setup_js"])
            time.sleep(0.5)  # Wait for rendering

            screenshot_path = str(screenshots_dir / f"{scene['id']}.png")
            page.screenshot(path=screenshot_path, type="png")
            scene["screenshot"] = screenshot_path

        browser.close()


async def generate_all_audio():
    """Generate TTS audio for all scenes."""
    audio_dir = TEMP_DIR / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    for i, scene in enumerate(SCENES):
        print(f"  Generating audio {i+1}/{len(SCENES)}: {scene['id']}")
        audio_path = str(audio_dir / f"{scene['id']}.mp3")
        await generate_tts(scene["narration"], audio_path)
        scene["audio"] = audio_path


def create_scene_clips():
    """Create individual video clips for each scene."""
    clips_dir = TEMP_DIR / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    for i, scene in enumerate(SCENES):
        print(f"  Creating clip {i+1}/{len(SCENES)}: {scene['id']}")
        duration = get_audio_duration(scene["audio"])
        # Add 0.5s padding at end
        total_duration = duration + 0.5

        clip_path = str(clips_dir / f"{scene['id']}.mp4")

        cmd = [
            FFMPEG, "-y",
            "-loop", "1",
            "-i", scene["screenshot"],
            "-i", scene["audio"],
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-vf", "scale=1920:1080",
            "-t", str(total_duration),
            "-shortest",
            clip_path,
        ]
        subprocess.run(cmd, capture_output=True, check=True)
        scene["clip"] = clip_path


def create_title_clip():
    """Create a title card clip."""
    from PIL import Image, ImageDraw, ImageFont

    title_img_path = str(TEMP_DIR / "title_card.png")
    title_audio_path = str(TEMP_DIR / "title_silence.aac")
    title_clip_path = str(TEMP_DIR / "clips" / "00_title.mp4")

    # Create title card image
    img = Image.new("RGB", (1920, 1080), color=(15, 23, 42))
    draw = ImageDraw.Draw(img)

    # Try to get a nice font, fallback to default
    try:
        font_large = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 72)
        font_medium = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
    except Exception:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Red gradient rectangle at top
    for y in range(0, 8):
        draw.rectangle([(0, y), (1920, y)], fill=(227, 6, 19))

    # Logo / brand area
    draw.rounded_rectangle([(860, 280), (1060, 380)], radius=20, fill=(227, 6, 19))
    draw.text((905, 300), "Sarah", fill="white", font=font_medium)

    # Title text
    title = "Sarah — Demo Visual"
    bbox = draw.textbbox((0, 0), title, font=font_large)
    tw = bbox[2] - bbox[0]
    draw.text(((1920 - tw) // 2, 420), title, fill="white", font=font_large)

    # Subtitle
    subtitle = "Chatbot inteligente con voz para Redegal"
    bbox2 = draw.textbbox((0, 0), subtitle, font=font_medium)
    sw = bbox2[2] - bbox2[0]
    draw.text(((1920 - sw) // 2, 520), subtitle, fill=(148, 163, 184), font=font_medium)

    # Features line
    features = "Chat IA  •  Click-to-Call VoIP  •  Dashboard de Agentes  •  Multi-idioma"
    bbox3 = draw.textbbox((0, 0), features, font=font_small)
    fw = bbox3[2] - bbox3[0]
    draw.text(((1920 - fw) // 2, 600), features, fill=(100, 116, 139), font=font_small)

    # Bottom bar
    draw.rectangle([(0, 1072), (1920, 1080)], fill=(227, 6, 19))

    img.save(title_img_path)

    # Generate 3 seconds of silence for title
    subprocess.run([
        FFMPEG, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-t", "3", "-c:a", "aac", title_audio_path,
    ], capture_output=True, check=True)

    # Create title clip
    subprocess.run([
        FFMPEG, "-y",
        "-loop", "1", "-i", title_img_path,
        "-i", title_audio_path,
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1920:1080",
        "-t", "3",
        "-shortest",
        title_clip_path,
    ], capture_output=True, check=True)

    return title_clip_path


def create_outro_clip():
    """Create an outro/closing card clip."""
    from PIL import Image, ImageDraw, ImageFont

    outro_img_path = str(TEMP_DIR / "outro_card.png")
    outro_audio_path = str(TEMP_DIR / "outro_silence.aac")
    outro_clip_path = str(TEMP_DIR / "clips" / "99_outro.mp4")

    img = Image.new("RGB", (1920, 1080), color=(15, 23, 42))
    draw = ImageDraw.Draw(img)

    try:
        font_large = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 64)
        font_medium = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
    except Exception:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Red top bar
    for y in range(0, 8):
        draw.rectangle([(0, y), (1920, y)], fill=(227, 6, 19))

    # Logo
    draw.rounded_rectangle([(860, 260), (1060, 360)], radius=20, fill=(227, 6, 19))
    draw.text((905, 280), "Sarah", fill="white", font=font_medium)

    # Main text
    main_text = "Sarah by Redegal"
    bbox = draw.textbbox((0, 0), main_text, font=font_large)
    tw = bbox[2] - bbox[0]
    draw.text(((1920 - tw) // 2, 400), main_text, fill="white", font=font_large)

    sub = "Chatbot IA  +  SarahPhone VoIP  +  Dashboard"
    bbox2 = draw.textbbox((0, 0), sub, font=font_medium)
    sw = bbox2[2] - bbox2[0]
    draw.text(((1920 - sw) // 2, 500), sub, fill=(148, 163, 184), font=font_medium)

    # Contact
    contact = "redegal.com"
    bbox3 = draw.textbbox((0, 0), contact, font=font_small)
    cw = bbox3[2] - bbox3[0]
    draw.text(((1920 - cw) // 2, 580), contact, fill=(227, 6, 19), font=font_small)

    # Features grid
    features = [
        "4 idiomas (ES/EN/PT/GL)",
        "4 CRM integrados",
        "VoIP WebRTC + SRTP",
        "Multi-tenant",
    ]
    y_start = 660
    for j, feat in enumerate(features):
        bbox_f = draw.textbbox((0, 0), feat, font=font_small)
        ffw = bbox_f[2] - bbox_f[0]
        draw.text(((1920 - ffw) // 2, y_start + j * 36), feat, fill=(100, 116, 139), font=font_small)

    # Bottom bar
    draw.rectangle([(0, 1072), (1920, 1080)], fill=(227, 6, 19))

    img.save(outro_img_path)

    subprocess.run([
        FFMPEG, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-t", "4", "-c:a", "aac", outro_audio_path,
    ], capture_output=True, check=True)

    subprocess.run([
        FFMPEG, "-y",
        "-loop", "1", "-i", outro_img_path,
        "-i", outro_audio_path,
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1920:1080",
        "-t", "4",
        "-shortest",
        outro_clip_path,
    ], capture_output=True, check=True)

    return outro_clip_path


def concatenate_clips():
    """Concatenate all clips into the final video."""
    clips_dir = TEMP_DIR / "clips"
    concat_file = TEMP_DIR / "concat.txt"

    # Gather all clips in order
    clip_files = []
    # Title first
    title_clip = clips_dir / "00_title.mp4"
    if title_clip.exists():
        clip_files.append(str(title_clip))

    # Scene clips in order
    for scene in SCENES:
        if "clip" in scene and Path(scene["clip"]).exists():
            clip_files.append(scene["clip"])

    # Outro last
    outro_clip = clips_dir / "99_outro.mp4"
    if outro_clip.exists():
        clip_files.append(str(outro_clip))

    # Write concat file
    with open(concat_file, "w") as f:
        for clip in clip_files:
            f.write(f"file '{clip}'\n")

    print(f"  Concatenating {len(clip_files)} clips...")

    subprocess.run([
        FFMPEG, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_file),
        "-c:v", "libx264",
        "-crf", "20",
        "-preset", "medium",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        str(OUTPUT),
    ], capture_output=True, check=True)


def send_email():
    """Send the video via email."""
    smtp_host = "smtp.gmail.com"
    smtp_port = 587
    smtp_user = "jorge.vazquez@redegal.com"
    smtp_pass = "fnhn lruh jsiw xvua"
    to_addr = "jorge.vazquez@redegal.com"

    file_size = OUTPUT.stat().st_size / (1024 * 1024)
    print(f"  Video size: {file_size:.1f} MB")

    msg = MIMEMultipart()
    msg["From"] = smtp_user
    msg["To"] = to_addr
    msg["Subject"] = "Sarah — Demo Visual en Web Redegal (con voz)"

    body = f"""Hola Jorge,

Adjunto la demo visual de Sarah en la web de Redegal.

El vídeo muestra 14 escenas con narración en español:
1. Web corporativa de Redegal con el botón de Sarah
2. Apertura del widget
3. Vista de bienvenida con líneas de negocio
4. Selección de Boostic (SEO & Growth)
5. Conversación con IA (información precisa, casos reales)
6. Respuestas rápidas y opciones
7. Escalación a agente humano (Ana García)
8. Botón Click-to-Call en la cabecera
9. Vista de llamada VoIP (conectando)
10. Llamada conectada (cifrado SRTP, calidad, timer)
11. Dashboard de agentes (3 conversaciones)
12. Chat del dashboard con historial completo
13. Resumen IA automático del lead
14. Vista final de la web

Duración: ~{file_size/2:.0f}min aprox
Resolución: 1920x1080
Tamaño: {file_size:.1f} MB

Generado automáticamente con Playwright + edge-tts + ffmpeg.

Un saludo,
Sarah Demo Generator
"""
    msg.attach(MIMEText(body, "plain", "utf-8"))

    if file_size < 24:
        with open(OUTPUT, "rb") as f:
            attachment = MIMEBase("application", "octet-stream")
            attachment.set_payload(f.read())
            encoders.encode_base64(attachment)
            attachment.add_header("Content-Disposition", f"attachment; filename=Sarah-Demo-Visual.mp4")
            msg.attach(attachment)
        print("  Video attached to email")
    else:
        body += f"\n\nNOTA: El vídeo pesa {file_size:.1f} MB (>24 MB), no se adjunta. Ruta: {OUTPUT}\n"
        msg.replace_header("Content-Type", "text/plain")

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_addr, msg.as_string())
        print("  Email sent successfully!")
    except Exception as e:
        print(f"  Email error: {e}")


def main():
    # Create temp directory
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    (TEMP_DIR / "screenshots").mkdir(exist_ok=True)
    (TEMP_DIR / "audio").mkdir(exist_ok=True)
    (TEMP_DIR / "clips").mkdir(exist_ok=True)

    print("=" * 60)
    print("  Sarah — Visual Screencast Generator")
    print("=" * 60)

    # Step 1: Capture screenshots
    print("\n[1/5] Capturing screenshots from demo page...")
    capture_screenshots()

    # Step 2: Generate narration audio
    print("\n[2/5] Generating narration audio (edge-tts)...")
    asyncio.run(generate_all_audio())

    # Step 3: Create title and outro
    print("\n[3/5] Creating title and outro cards...")
    create_title_clip()
    create_outro_clip()

    # Step 4: Create scene clips
    print("\n[4/5] Creating scene video clips...")
    create_scene_clips()

    # Step 5: Concatenate
    print("\n[5/5] Concatenating into final video...")
    concatenate_clips()

    file_size = OUTPUT.stat().st_size / (1024 * 1024)
    print(f"\n{'=' * 60}")
    print(f"  Video generated: {OUTPUT}")
    print(f"  Size: {file_size:.1f} MB")
    print(f"{'=' * 60}")

    # Step 6: Send email
    print("\n[6] Sending email...")
    send_email()

    print("\nDone!")


if __name__ == "__main__":
    main()
