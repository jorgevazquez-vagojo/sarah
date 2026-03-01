#!/usr/bin/env python3
"""
Sarah - Narrated Video Presentation Generator
Generates a 93-slide video with Spanish voice narration using edge-tts.
"""

import asyncio
import os
import subprocess
import sys
import math
from PIL import Image, ImageDraw, ImageFont

# ─── Configuration ────────────────────────────────────────────────────────────

WIDTH, HEIGHT = 1920, 1080
TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "video-temp")
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Sarah-Video-Narrado.mp4")

# Brand colors
BG_COLOR = (10, 15, 26)         # #0A0F1A
PRIMARY = (0, 127, 255)         # #007FFF
ACCENT = (0, 212, 170)          # #00D4AA
WHITE = (255, 255, 255)         # #FFFFFF
GRAY_TEXT = (136, 146, 164)     # #8892A4
LIGHT_GRAY = (200, 208, 220)   # #C8D0DC

# Fonts
FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

# TTS
VOICE = "es-ES-ElviraNeural"
TTS_RATE = "+0%"

# ─── Slide Data ───────────────────────────────────────────────────────────────

SLIDES = [
    # SECTION 1: INTRO
    {
        "num": 1, "type": "cover",
        "title": "Sarah",
        "subtitle": "Chatbot IA Premium con Voz Integrada",
        "narration": "Bienvenidos a la presentacion de Sarah, el chatbot inteligente con voz integrada para empresas. Sarah combina inteligencia artificial, comunicaciones por voz y un dashboard completo de operaciones."
    },
    {
        "num": 2, "type": "content",
        "title": "Que es Sarah?",
        "bullets": [
            "Chatbot premium con IA multi-proveedor",
            "Llamadas VoIP Click to Call integradas",
            "Dashboard completo para agentes y operadores",
            "Solucion enterprise todo-en-uno"
        ],
        "narration": "Que es Sarah? Es un chatbot premium con inteligencia artificial multi-proveedor, que incluye llamadas VoIP Click to Call integradas y un dashboard completo para agentes y operadores comerciales."
    },
    {
        "num": 3, "type": "content",
        "title": "Stack Tecnologico",
        "bullets": [
            "Node.js 20 — Servidor de alto rendimiento",
            "React 19 — Interfaces modernas",
            "PostgreSQL 16 + pgvector — Busqueda semantica",
            "Redis 7 — Cache y sesiones",
            "Janus — Gateway WebRTC para llamadas"
        ],
        "narration": "Sarah esta construido con las tecnologias mas modernas: Node.js 20 en el servidor, React 19 para las interfaces, PostgreSQL 16 con extension pgvector para busqueda semantica, Redis 7 para cache y Janus como gateway WebRTC para las llamadas."
    },
    {
        "num": 4, "type": "content",
        "title": "Arquitectura de 3 Workspaces",
        "bullets": [
            "server/ — API REST + WebSocket",
            "widget/ — Chatbot embebible IIFE + Shadow DOM",
            "dashboard/ — SPA para agentes",
            "Docker Compose orquesta todo"
        ],
        "narration": "La arquitectura se organiza en tres workspaces: el servidor con la API REST y WebSocket, el widget del chatbot que se embebe en cualquier web, y el dashboard para los agentes. Todo orquestado con Docker Compose."
    },
    {
        "num": 5, "type": "content",
        "title": "Docker Compose — 4 Servicios",
        "bullets": [
            "PostgreSQL — Base de datos relacional",
            "Redis — Cache y sesiones",
            "Server Node.js — Puerto 9456",
            "Janus — Gateway WebRTC para voz"
        ],
        "narration": "Docker Compose levanta cuatro servicios: PostgreSQL para la base de datos, Redis para cache y sesiones, el servidor Node.js en el puerto 9456, y Janus como gateway WebRTC para las comunicaciones de voz."
    },
    {
        "num": 6, "type": "content",
        "title": "Capacidades Clave",
        "bullets": [
            "4 idiomas con deteccion automatica",
            "IA con fallback entre proveedores",
            "Integraciones CRM + Webhooks firmados",
            "Grabacion de llamadas + Transcripcion",
            "Sistema de aprendizaje continuo"
        ],
        "narration": "Las capacidades clave incluyen soporte para 4 idiomas con deteccion automatica, inteligencia artificial con fallback entre proveedores, integraciones CRM, webhooks firmados, grabacion de llamadas con transcripcion automatica y un sistema de aprendizaje continuo."
    },
    # SECTION 2: INSTALACION
    {
        "num": 7, "type": "section",
        "section_num": 2,
        "title": "Instalacion",
        "narration": "Veamos como se instala Sarah. Todo el proceso se puede completar con un solo comando."
    },
    {
        "num": 8, "type": "content",
        "title": "Prerrequisitos",
        "bullets": [
            "Node.js v18 o superior",
            "Docker + Docker Compose",
            "npm como gestor de paquetes"
        ],
        "narration": "Los prerrequisitos son Node.js version 18 o superior, Docker y Docker Compose instalados, y npm como gestor de paquetes."
    },
    {
        "num": 9, "type": "content",
        "title": "Paso 1 — Clonar Repositorio",
        "bullets": [
            "git clone <repo-url>",
            "cd redegal-chatbot",
            "Estructura de proyecto lista"
        ],
        "narration": "El primer paso es clonar el repositorio con git clone y entrar en el directorio del proyecto."
    },
    {
        "num": 10, "type": "content",
        "title": "Paso 2 — Setup Interactivo",
        "bullets": [
            "npm run setup — Script interactivo",
            "Genera todos los secretos automaticamente",
            "Configura variables de entorno"
        ],
        "narration": "Ejecutamos el script de setup, que es interactivo y se encarga de generar automaticamente todos los secretos necesarios: tokens JWT, claves de API y contrasenas de base de datos."
    },
    {
        "num": 11, "type": "content",
        "title": "Secretos Auto-generados",
        "bullets": [
            "JWT Secret para autenticacion",
            "API Keys para el widget",
            "Contrasenas PostgreSQL y Redis",
            "Claves de cifrado AES-256"
        ],
        "narration": "El setup genera de forma segura el JWT Secret para autenticacion, las API keys para el widget, las contrasenas de PostgreSQL y Redis, y las claves de cifrado."
    },
    {
        "num": 12, "type": "content",
        "title": "Paso 3 — Docker Compose",
        "bullets": [
            "Levanta 4 servicios orquestados",
            "Respeta dependencias entre servicios",
            "Health checks automaticos"
        ],
        "narration": "Docker Compose se encarga de levantar los cuatro servicios de forma orquestada, respetando las dependencias entre ellos."
    },
    {
        "num": 13, "type": "content",
        "title": "Inicio Rapido",
        "bullets": [
            "docker-compose up -d",
            "4 contenedores: PG, Redis, Server, Janus",
            "Menos de 1 minuto para estar operativo"
        ],
        "narration": "Con el comando docker-compose up menos d, los cuatro contenedores se inician: PostgreSQL, Redis, el servidor y Janus. En menos de un minuto todo esta funcionando."
    },
    {
        "num": 14, "type": "content",
        "title": "Inicializacion Automatica",
        "bullets": [
            "Esquema de BD: +20 tablas creadas",
            "Knowledge base cargado desde YAML",
            "Usuario admin creado por defecto"
        ],
        "narration": "La inicializacion automatica crea el esquema de base de datos con mas de 20 tablas, carga la base de conocimiento desde archivos YAML y crea el usuario administrador por defecto."
    },
    {
        "num": 15, "type": "content",
        "title": "URLs Disponibles",
        "bullets": [
            "/test — Pagina de test del widget",
            "/dashboard — Panel de agentes",
            "/health — Endpoint de monitorizacion"
        ],
        "narration": "Una vez instalado, las URLs disponibles son: la pagina de test del widget, el dashboard de agentes, y el endpoint de salud para monitorizacion."
    },
    {
        "num": 16, "type": "content",
        "title": "Wizard de Configuracion",
        "bullets": [
            "SMTP — Correo electronico",
            "SIP Vozelia — Centralita telefonica",
            "Proveedor IA preferido",
            "Horario comercial",
            "Colores corporativos"
        ],
        "narration": "El wizard de configuracion web permite configurar el correo SMTP, la centralita SIP de Vozelia, seleccionar el proveedor de IA preferido, establecer el horario comercial y personalizar los colores corporativos."
    },
    {
        "num": 17, "type": "content",
        "title": "Variables de Entorno (.env)",
        "bullets": [
            "+40 variables configurables",
            "Categorias: BD, Cache, IA, VoIP, Email",
            "Secretos auto-generados en setup"
        ],
        "narration": "El archivo punto env contiene mas de 40 variables configurables, organizadas por categorias: base de datos, cache, inteligencia artificial, VoIP, correo electronico y configuracion de negocio."
    },
    {
        "num": 18, "type": "content",
        "title": "Verificacion de Salud",
        "bullets": [
            "curl localhost:9456/health",
            "Responde OK + checks de PG y Redis",
            "Instalacion completa verificada"
        ],
        "narration": "Para verificar que todo funciona, basta con hacer un curl al endpoint de salud. Si responde OK con los checks de PostgreSQL y Redis en verde, la instalacion esta completa."
    },
    # SECTION 3: CONFIGURACION
    {
        "num": 19, "type": "section",
        "section_num": 3,
        "title": "Configuracion",
        "narration": "Pasemos ahora a la configuracion completa del sistema."
    },
    {
        "num": 20, "type": "content",
        "title": "Panel de Ajustes",
        "bullets": [
            "Dashboard > Pestana Ajustes",
            "6 categorias principales",
            "Interfaz intuitiva con guardado en tiempo real"
        ],
        "narration": "El panel de ajustes se accede desde el Dashboard, pestana Ajustes. Esta organizado en seis categorias principales para facilitar la navegacion."
    },
    {
        "num": 21, "type": "content",
        "title": "Branding Corporativo",
        "bullets": [
            "Nombre de empresa personalizable",
            "Logotipo corporativo",
            "Colores: primario, secundario, acento",
            "Favicon personalizado"
        ],
        "narration": "La seccion de branding permite personalizar el nombre de la empresa, el logotipo, los colores primario, secundario y de acento, y el favicon."
    },
    {
        "num": 22, "type": "content",
        "title": "Tipografia",
        "bullets": [
            "Familia de fuente configurable",
            "Tamano base del texto",
            "Tamano de cabeceras",
            "Tamano de mensajes del chat"
        ],
        "narration": "La tipografia es completamente configurable: familia de fuente, tamano base, tamano de cabeceras y tamano de los mensajes del chat."
    },
    {
        "num": 23, "type": "content",
        "title": "Layout del Widget",
        "bullets": [
            "Posicion: esquina inferior derecha/izquierda",
            "Offset X/Y, ancho, alto maximo",
            "Radio de bordes, z-index",
            "Fullscreen en movil (opcional)"
        ],
        "narration": "El layout del widget se puede ajustar: posicion en pantalla, desplazamiento horizontal y vertical, ancho, alto maximo, radio de bordes e indice Z. Tambien se puede activar pantalla completa en movil."
    },
    {
        "num": 24, "type": "content",
        "title": "Feature Toggles",
        "bullets": [
            "VoIP, Archivos, Emojis, CSAT",
            "Formulario leads, Quick replies",
            "Rich messages, Sonidos, Read receipts",
            "Typing indicator, Idioma, Modo oscuro"
        ],
        "narration": "Cada funcionalidad se puede activar o desactivar individualmente: VoIP, subida de archivos, emojis, encuestas de satisfaccion, formulario de leads, respuestas rapidas, mensajes enriquecidos, sonidos, confirmaciones de lectura, indicador de escritura, selector de idioma, lineas de negocio y modo oscuro."
    },
    {
        "num": 25, "type": "content",
        "title": "4 Idiomas con Auto-Deteccion",
        "bullets": [
            "Espanol (ES)",
            "Ingles (EN)",
            "Portugues (PT)",
            "Gallego (GL)",
            "Auto-deteccion por navegador"
        ],
        "narration": "Sarah soporta cuatro idiomas: espanol, ingles, portugues y gallego. La deteccion es automatica basandose en el idioma del navegador, pero el usuario tambien puede cambiarlo manualmente."
    },
    {
        "num": 26, "type": "content",
        "title": "4 Lineas de Negocio",
        "bullets": [
            "Boostic — SEO y crecimiento organico",
            "Binnacle — Inteligencia de negocio",
            "Marketing — Marketing digital",
            "Tech — Desarrollo tecnologico"
        ],
        "narration": "Las cuatro lineas de negocio son Boostic para SEO y crecimiento, Binnacle para inteligencia de negocio, Marketing para marketing digital, y Tech para desarrollo tecnologico. Cada una tiene su propio icono, color y enrutamiento de llamadas."
    },
    {
        "num": 27, "type": "content",
        "title": "Horario Comercial",
        "bullets": [
            "Zona horaria: Europe/Madrid",
            "Lunes a Viernes: 09:00 - 19:00",
            "Festivos personalizables",
            "Modo offline fuera de horario"
        ],
        "narration": "El horario comercial se configura con zona horaria, en este caso Europa Madrid, horario de lunes a viernes de 9 a 19 horas, y una lista de dias festivos personalizable."
    },
    {
        "num": 28, "type": "content",
        "title": "IA Multi-Proveedor con Fallback",
        "bullets": [
            "Primario: Claude Sonnet",
            "Respaldo: Gemini Flash (gratuito)",
            "Ultimo recurso: GPT-4o mini",
            "Cambio automatico si uno falla"
        ],
        "narration": "El sistema de IA utiliza tres proveedores con fallback automatico: Claude Sonnet como primario, Gemini Flash como respaldo gratuito, y GPT 4 o mini como ultima opcion. Si uno falla, pasa automaticamente al siguiente."
    },
    {
        "num": 29, "type": "content",
        "title": "Knowledge Base (YAML)",
        "bullets": [
            "6 archivos YAML de conocimiento",
            "Info general + 1 por linea de negocio",
            "Casos de exito incluidos",
            "Inyeccion automatica en contexto IA"
        ],
        "narration": "La base de conocimiento se compone de seis archivos YAML: informacion general de la empresa, y uno especifico para cada linea de negocio mas los casos de exito. Esta informacion se inyecta automaticamente en el contexto de la IA."
    },
    {
        "num": 30, "type": "content",
        "title": "Configuracion SMTP",
        "bullets": [
            "Servidor, puerto, usuario, contrasena",
            "Boton de prueba integrado",
            "Verificacion antes de guardar"
        ],
        "narration": "La configuracion de correo SMTP incluye servidor, puerto, usuario y contrasena, con un boton de prueba para verificar que funciona antes de guardar."
    },
    {
        "num": 31, "type": "content",
        "title": "Integracion SIP — Vozelia Cloud",
        "bullets": [
            "Dominio PBX configurado",
            "Extension y contrasena SIP",
            "Click to Call desde el widget"
        ],
        "narration": "La integracion SIP con la centralita Vozelia Cloud se configura con el dominio del PBX, el numero de extension y la contrasena. Esto permite las llamadas Click to Call."
    },
    {
        "num": 32, "type": "content",
        "title": "Integraciones CRM",
        "bullets": [
            "Salesforce — OAuth2 completo",
            "HubSpot — API Key",
            "Zoho + Pipedrive — Preparados",
            "Envio automatico de leads"
        ],
        "narration": "Sarah se integra con cuatro CRM: Salesforce con OAuth2, HubSpot con API key, y adaptadores preparados para Zoho y Pipedrive. Cada lead capturado se envia automaticamente al CRM configurado."
    },
    {
        "num": 33, "type": "content",
        "title": "Webhooks Seguros",
        "bullets": [
            "10 tipos de eventos soportados",
            "Firma HMAC SHA-256",
            "Reintento exponencial (hasta 5x)",
            "Proteccion anti-SSRF"
        ],
        "narration": "Los webhooks soportan diez tipos de eventos, estan firmados con HMAC SHA256 para seguridad, tienen reintento exponencial hasta cinco veces, y proteccion contra ataques SSRF."
    },
    {
        "num": 34, "type": "content",
        "title": "Respuestas Predefinidas",
        "bullets": [
            "Sintaxis /atajo para expansion rapida",
            "/saludo -> mensaje de bienvenida completo",
            "Multi-idioma configurable",
            "Asignables por linea de negocio"
        ],
        "narration": "Las respuestas predefinidas usan sintaxis de barra diagonal: el agente escribe barra saludo y se expande automaticamente al texto completo. Estan disponibles en multiples idiomas y se pueden asignar a lineas de negocio especificas."
    },
    {
        "num": 35, "type": "content",
        "title": "Triggers Proactivos",
        "bullets": [
            "Tiempo en pagina > 30 seg",
            "Visita a pagina de precios",
            "Intencion de salida detectada",
            "Visitante recurrente",
            "Abandono de carrito / Formulario inactivo"
        ],
        "narration": "Los triggers proactivos detectan seis situaciones: tiempo en pagina superior a 30 segundos, visita a pagina de precios, intencion de salida, visitante recurrente, abandono de carrito y formulario inactivo. Cada uno lanza un mensaje personalizado."
    },
    {
        "num": 36, "type": "content",
        "title": "Seguridad Avanzada",
        "bullets": [
            "CORS whitelist + CSRF protection",
            "Sanitizacion XSS en entrada/salida",
            "Rate limiting en WebSocket",
            "JWT + bcrypt + SSRF protection"
        ],
        "narration": "La seguridad incluye CORS con lista blanca de origenes, proteccion CSRF, sanitizacion contra XSS, limitacion de velocidad en WebSocket, autenticacion JWT, cifrado de contrasenas con bcrypt y proteccion SSRF en webhooks."
    },
    # SECTION 4: CHATBOT — USUARIO
    {
        "num": 37, "type": "section",
        "section_num": 4,
        "title": "Chatbot — Experiencia de Usuario",
        "narration": "Veamos ahora la experiencia del visitante al interactuar con el chatbot."
    },
    {
        "num": 38, "type": "content",
        "title": "Widget Flotante",
        "bullets": [
            "Boton circular esquina inferior derecha",
            "Animacion de pulso sutil",
            "Invita a hacer clic"
        ],
        "narration": "El widget aparece como un boton circular en la esquina inferior derecha de la web, con una sutil animacion de pulso que invita a hacer clic."
    },
    {
        "num": 39, "type": "content",
        "title": "Vista de Bienvenida",
        "bullets": [
            "Saludo personalizado al usuario",
            "4 tarjetas de lineas de negocio",
            "Seleccion de tema de ayuda",
            "Diseno limpio y profesional"
        ],
        "narration": "Al abrir, la vista de bienvenida muestra un saludo personalizado y cuatro tarjetas con las lineas de negocio. El visitante selecciona sobre que tema necesita ayuda."
    },
    {
        "num": 40, "type": "content",
        "title": "Selector de Idioma",
        "bullets": [
            "Espana — Espanol",
            "Reino Unido — Ingles",
            "Portugal — Portugues",
            "Galicia — Gallego",
            "Auto-deteccion + cambio manual"
        ],
        "narration": "El selector de idioma muestra las banderas de Espana, Reino Unido, Portugal y Galicia. El sistema auto-detecta el idioma del navegador pero permite cambiarlo en cualquier momento."
    },
    {
        "num": 41, "type": "content",
        "title": "Vista de Chat",
        "bullets": [
            "Burbujas de mensaje con timestamps",
            "Avatar del bot personalizable",
            "Interfaz limpia y moderna",
            "Tipografia clara y legible"
        ],
        "narration": "La vista de chat muestra las burbujas de mensaje con timestamps y el avatar del bot. La interfaz es limpia y moderna con tipografia clara."
    },
    {
        "num": 42, "type": "content",
        "title": "Respuestas IA Contextuales",
        "bullets": [
            "Knowledge base inyectado automaticamente",
            "Respuestas precisas sobre servicios",
            "Casos de exito citados",
            "Datos de empresa actualizados"
        ],
        "narration": "La inteligencia artificial responde con contexto del knowledge base inyectado automaticamente. Las respuestas son precisas porque conoce los servicios, casos de exito y datos de la empresa."
    },
    {
        "num": 43, "type": "content",
        "title": "Quick Replies",
        "bullets": [
            "Botones debajo del mensaje",
            "Si / No / Mas informacion",
            "Contactar / Precios",
            "Interaccion sin necesidad de escribir"
        ],
        "narration": "Las respuestas rapidas aparecen como botones debajo del mensaje: Si, No, Mas informacion, Contactar y Precios. Facilitan la interaccion sin necesidad de escribir."
    },
    {
        "num": 44, "type": "content",
        "title": "Mensajes Enriquecidos (Cards)",
        "bullets": [
            "Imagen + Titulo + Descripcion",
            "Botones de accion interactivos",
            "Ideal para servicios y productos"
        ],
        "narration": "Los mensajes enriquecidos incluyen cards con imagen, titulo, descripcion y botones de accion. Son ideales para mostrar servicios o productos."
    },
    {
        "num": 45, "type": "content",
        "title": "Carruseles",
        "bullets": [
            "Multiples cards deslizables",
            "Scroll horizontal tactil",
            "Comparar opciones facilmente",
            "Perfecto para catalogos"
        ],
        "narration": "Los carruseles permiten mostrar multiples cards que se deslizan horizontalmente. Perfectos para comparar opciones o mostrar un catalogo."
    },
    {
        "num": 46, "type": "content",
        "title": "Subida de Archivos",
        "bullets": [
            "Imagenes, PDFs, documentos",
            "Limite: 10 MB por archivo",
            "Preview inline en el chat"
        ],
        "narration": "La subida de archivos permite enviar imagenes, PDFs y documentos de hasta 10 megabytes, con preview inline en el chat."
    },
    {
        "num": 47, "type": "content",
        "title": "Indicadores de Estado",
        "bullets": [
            "3 puntos de escritura (typing)",
            "Doble check de lectura",
            "Hora de envio en cada mensaje"
        ],
        "narration": "Los indicadores de estado incluyen los tres puntos de escritura mientras el bot procesa, doble check de lectura y la hora de envio de cada mensaje."
    },
    {
        "num": 48, "type": "content",
        "title": "Modo Oscuro",
        "bullets": [
            "Toggle en la cabecera del widget",
            "Cambio completo de tema",
            "Colores oscuros para poca luz",
            "Preferencia guardada en sesion"
        ],
        "narration": "El modo oscuro se activa con un toggle en la cabecera del widget. Cambia todo el tema a colores oscuros para entornos con poca luz."
    },
    {
        "num": 49, "type": "content",
        "title": "Notificaciones Sonoras",
        "bullets": [
            "Aviso al recibir nuevo mensaje",
            "Funciona con chat cerrado",
            "Sonido configurable"
        ],
        "narration": "Las notificaciones sonoras avisan al visitante cuando llega un nuevo mensaje, incluso si no tiene el chat abierto. El sonido es configurable."
    },
    {
        "num": 50, "type": "content",
        "title": "Modo Offline",
        "bullets": [
            "Fuera de horario comercial",
            "Formulario: nombre, email, mensaje",
            "Envio automatico por email al equipo"
        ],
        "narration": "Fuera del horario comercial, el widget muestra un formulario offline donde el visitante deja su nombre, email y mensaje. Se envia automaticamente por email al equipo."
    },
    {
        "num": 51, "type": "content",
        "title": "Formulario de Captacion de Leads",
        "bullets": [
            "Campos: nombre, email, telefono, empresa",
            "Puntuacion automatica 0-100",
            "Envio a CRM configurado"
        ],
        "narration": "El formulario de captacion recoge nombre, email, telefono y empresa. El sistema asigna automaticamente una puntuacion de calidad de 0 a 100 al lead."
    },
    {
        "num": 52, "type": "content",
        "title": "Encuesta de Satisfaccion (CSAT)",
        "bullets": [
            "5 estrellas + campo de comentario",
            "Aparece al cerrar conversacion",
            "Resultados almacenados + webhook"
        ],
        "narration": "Al cerrar la conversacion, aparece una encuesta de satisfaccion con 5 estrellas y un campo de comentario. Los resultados se almacenan y se envian por webhook."
    },
    {
        "num": 53, "type": "content",
        "title": "Triggers Proactivos en Accion",
        "bullets": [
            "Detecta comportamiento del visitante",
            "30 seg en web -> Mensaje proactivo",
            "Personalizable por pagina/evento"
        ],
        "narration": "Los triggers proactivos detectan comportamiento del visitante. Por ejemplo, despues de 30 segundos en la web, el chatbot puede preguntar: Veo que llevas un rato aqui, puedo ayudarte?"
    },
    {
        "num": 54, "type": "content",
        "title": "Escalacion a Agente Humano",
        "bullets": [
            "Visitante pide hablar con persona",
            "Dashboard recibe notificacion real-time",
            "Email con contexto de conversacion",
            "Transferencia transparente"
        ],
        "narration": "Cuando el visitante pide hablar con una persona, se activa la escalacion: el dashboard recibe una notificacion en tiempo real y se envia un email con el contexto de la conversacion."
    },
    # SECTION 5: CLICK2CALL Y WEBRTC
    {
        "num": 55, "type": "section",
        "section_num": 5,
        "title": "SarahPhone — VoIP Integrada",
        "narration": "Hablemos ahora de SarahPhone, el sistema de llamadas VoIP integrado."
    },
    {
        "num": 56, "type": "content",
        "title": "Flujo Click to Call",
        "bullets": [
            "1. Visitante pulsa Llamar en widget",
            "2. WebRTC via Janus Gateway",
            "3. SIP a centralita Vozelia",
            "4. Extension del agente suena"
        ],
        "narration": "El flujo es asi: el visitante pulsa Llamar en el widget, se establece una conexion WebRTC a traves del gateway Janus, que lo conecta via SIP con la centralita Vozelia, y finalmente suena la extension del agente."
    },
    {
        "num": 57, "type": "content",
        "title": "Vista de Llamada en Widget",
        "bullets": [
            "Controles: microfono y colgar",
            "Indicador de calidad de audio",
            "Interfaz minimalista"
        ],
        "narration": "La vista de llamada en el widget muestra los controles de microfono y colgar, junto con un indicador visual de la calidad del audio en tiempo real."
    },
    {
        "num": 58, "type": "content",
        "title": "Janus — Gateway WebRTC",
        "bullets": [
            "Recibe audio WebRTC del navegador",
            "Convierte a protocolo SIP",
            "Conecta con centralita telefonica",
            "Alta disponibilidad"
        ],
        "narration": "Janus actua como gateway WebRTC: recibe el audio del navegador mediante WebRTC y lo convierte a protocolo SIP para conectar con la centralita telefonica."
    },
    {
        "num": 59, "type": "content",
        "title": "Monitoreo de Calidad de Audio",
        "bullets": [
            "Jitter medido en tiempo real",
            "Perdida de paquetes monitorizada",
            "Estadisticas RTC completas",
            "Garantia de buena experiencia"
        ],
        "narration": "El monitoreo de calidad de audio mide en tiempo real el jitter, la perdida de paquetes y las estadisticas de la conexion RTC para garantizar una buena experiencia."
    },
    {
        "num": 60, "type": "content",
        "title": "Flujo SIP Completo",
        "bullets": [
            "INVITE -> 100 Trying",
            "180 Ringing -> 200 OK",
            "Canal de audio RTP establecido",
            "BYE para colgar"
        ],
        "narration": "El flujo SIP completo es: INVITE, 100 Trying, 180 Ringing, 200 OK para establecer el canal de audio RTP, y BYE para colgar."
    },
    {
        "num": 61, "type": "content",
        "title": "Recepcion de Llamada",
        "bullets": [
            "Agente recibe en extension Vozelia",
            "Caller ID: 'Lead Web'",
            "Contexto del visitante disponible"
        ],
        "narration": "Con Click to Call, el agente recibe la llamada directamente en su extension de Vozelia. El identificador de llamada muestra Lead Web para que sepa que es un visitante de la web."
    },
    {
        "num": 62, "type": "content",
        "title": "Grabacion de Llamadas",
        "bullets": [
            "Formato WAV o MP3",
            "Retencion: 30 dias",
            "Limpieza automatica cada 6 horas"
        ],
        "narration": "La grabacion de llamadas es automatica en formato WAV o MP3, con retencion de 30 dias y limpieza automatica cada 6 horas."
    },
    {
        "num": 63, "type": "content",
        "title": "Transcripcion Automatica",
        "bullets": [
            "Motor principal: OpenAI Whisper",
            "Respaldo: Google Gemini",
            "Texto buscable en BD",
            "Accesible desde Dashboard"
        ],
        "narration": "La transcripcion automatica usa OpenAI Whisper como motor principal y Google Gemini como respaldo. El texto resultante es buscable y se almacena en la base de datos."
    },
    {
        "num": 64, "type": "content",
        "title": "Callback — Llamada de Vuelta",
        "bullets": [
            "Visitante selecciona hora preferida",
            "Recordatorio automatico al agente",
            "Mejora la experiencia del usuario"
        ],
        "narration": "El visitante puede agendar una llamada de vuelta seleccionando su hora preferida. El sistema envia un recordatorio al agente cuando llega el momento."
    },
    {
        "num": 65, "type": "content",
        "title": "Enrutamiento por Linea de Negocio",
        "bullets": [
            "Cada BU tiene su extension",
            "Boostic -> Extension A",
            "Tech -> Extension B",
            "Llamadas dirigidas al equipo correcto"
        ],
        "narration": "Cada linea de negocio puede tener una extension telefonica diferente, de forma que las llamadas de Boostic van a un equipo y las de Tech van a otro."
    },
    {
        "num": 66, "type": "content",
        "title": "Modo Fuera de Horario",
        "bullets": [
            "Boton de llamar deshabilitado",
            "Formulario de contacto alternativo",
            "Transicion automatica"
        ],
        "narration": "Fuera del horario comercial, el boton de llamar se reemplaza automaticamente por un formulario de contacto offline."
    },
    # SECTION 6: DASHBOARD
    {
        "num": 67, "type": "section",
        "section_num": 6,
        "title": "Dashboard de Operaciones",
        "narration": "Pasemos al Dashboard, el centro de operaciones para agentes y comerciales."
    },
    {
        "num": 68, "type": "content",
        "title": "Login y Roles",
        "bullets": [
            "Autenticacion JWT segura",
            "Admin — Acceso total",
            "Supervisor — Solo lectura completa",
            "Agente — Acceso a su cola"
        ],
        "narration": "El login requiere usuario y contrasena. Se genera un token JWT para la sesion. Hay tres roles: administrador con acceso total, supervisor que puede ver todo, y agente con acceso a su cola."
    },
    {
        "num": 69, "type": "content",
        "title": "Navegacion Principal",
        "bullets": [
            "Sidebar con 6 pestanas",
            "Area de contenido a la derecha",
            "Diseno responsive y funcional"
        ],
        "narration": "La vista principal tiene una barra lateral de navegacion a la izquierda con las seis pestanas principales, y el area de contenido a la derecha."
    },
    {
        "num": 70, "type": "content",
        "title": "Cola de Conversaciones",
        "bullets": [
            "Cola en tiempo real",
            "Tiempo de espera visible",
            "Mensajes sin leer destacados",
            "Un clic para abrir conversacion"
        ],
        "narration": "La pestana de Conversaciones muestra la cola en tiempo real: cada conversacion con su tiempo de espera, mensajes sin leer y un clic para abrirla."
    },
    {
        "num": 71, "type": "content",
        "title": "Vista de Conversacion",
        "bullets": [
            "Historial completo de mensajes",
            "Respuestas del agente en tiempo real",
            "Notas internas (invisibles al visitante)"
        ],
        "narration": "Al abrir una conversacion, el agente ve el historial completo de mensajes, puede escribir respuestas y anadir notas internas que el visitante no ve."
    },
    {
        "num": 72, "type": "content",
        "title": "Agente Conectado",
        "bullets": [
            "Mensaje 'Agente conectado' al visitante",
            "Comunicacion directa humano-humano",
            "Transicion transparente desde bot"
        ],
        "narration": "Cuando el agente toma una conversacion, el visitante ve inmediatamente el mensaje Agente conectado, y la comunicacion pasa a ser directa."
    },
    {
        "num": 73, "type": "content",
        "title": "Atajos de Respuesta",
        "bullets": [
            "/atajo -> expansion automatica",
            "/saludo -> mensaje de bienvenida",
            "Ahorra tiempo al agente"
        ],
        "narration": "Las respuestas predefinidas se activan escribiendo barra y el nombre del atajo. Por ejemplo, barra saludo se expande a un mensaje de bienvenida completo."
    },
    {
        "num": 74, "type": "content",
        "title": "Pipeline de Leads",
        "bullets": [
            "Puntuacion de calidad 0-100",
            "Estados: Nuevo, Contactado, Cualificado",
            "Convertido o Perdido",
            "Filtros y busqueda avanzada"
        ],
        "narration": "La pestana de Leads muestra el pipeline de prospectos con su puntuacion de calidad de 0 a 100, y el estado: nuevo, contactado, cualificado, convertido o perdido."
    },
    {
        "num": 75, "type": "content",
        "title": "Analytics — Metricas Diarias",
        "bullets": [
            "Tasa de resolucion",
            "CSAT promedio",
            "Tiempo medio de respuesta",
            "Tasa de conversion"
        ],
        "narration": "La pestana de Analytics presenta metricas diarias: tasa de resolucion, puntuacion CSAT promedio, tiempo medio de respuesta y tasa de conversion."
    },
    {
        "num": 76, "type": "content",
        "title": "Graficos y Tendencias",
        "bullets": [
            "Barras por hora del dia",
            "Lineas de tendencia semanal",
            "Distribucion CSAT (1-5 estrellas)"
        ],
        "narration": "Los graficos incluyen barras por hora del dia, lineas de tendencia semanal y la distribucion de puntuaciones CSAT de 1 a 5 estrellas."
    },
    {
        "num": 77, "type": "content",
        "title": "Historial de Llamadas",
        "bullets": [
            "Duracion de cada llamada",
            "Grabaciones reproducibles en navegador",
            "Transcripciones completas"
        ],
        "narration": "La pestana de Llamadas muestra el historial completo: duracion de cada llamada, grabaciones reproducibles directamente en el navegador, y transcripciones completas."
    },
    {
        "num": 78, "type": "content",
        "title": "Entrenamiento del Bot",
        "bullets": [
            "Revisar respuestas del bot",
            "Marcar: Buena, Mala, Corregida",
            "Alimentar aprendizaje automatico"
        ],
        "narration": "La pestana de Entrenamiento permite revisar las respuestas del bot, marcarlas como buenas, malas o corregidas, y alimentar el sistema de aprendizaje automatico."
    },
    {
        "num": 79, "type": "content",
        "title": "Sistema de Aprendizaje",
        "bullets": [
            "CSAT >= 4 estrellas -> Respuesta buena",
            "Marcado automatico de calidad",
            "Embeddings vectoriales guardados",
            "Mejora continua sin intervencion"
        ],
        "narration": "El sistema de aprendizaje funciona asi: cuando una conversacion recibe CSAT de 4 o mas estrellas, las respuestas del bot se marcan automaticamente como buenas y se guardan como embeddings vectoriales."
    },
    {
        "num": 80, "type": "content",
        "title": "Busqueda Semantica",
        "bullets": [
            "Pregunta similar -> Respuesta aprendida",
            "Busqueda por similitud vectorial",
            "Respuestas corregidas priorizadas"
        ],
        "narration": "Las respuestas aprendidas se utilizan en futuras conversaciones: cuando un visitante pregunta algo similar, el sistema recupera la respuesta corregida o validada gracias a la busqueda por similitud semantica."
    },
    {
        "num": 81, "type": "content",
        "title": "Wallboard — Tiempo Real",
        "bullets": [
            "Pantalla de KPIs para call centers",
            "Actualizacion cada 5 segundos",
            "Metricas en tiempo real"
        ],
        "narration": "El Wallboard es una pantalla de indicadores clave para call centers: se actualiza cada 5 segundos con metricas en tiempo real como llamadas activas, chats en cola y agentes conectados."
    },
    {
        "num": 82, "type": "content",
        "title": "Metricas del Wallboard",
        "bullets": [
            "Llamadas activas + Chats activos",
            "Visitantes en cola",
            "Agentes online",
            "% SLA + CSAT promedio del dia"
        ],
        "narration": "Las metricas del Wallboard incluyen: llamadas activas, chats activos, visitantes en cola, agentes online, porcentaje de SLA y CSAT promedio del dia."
    },
    {
        "num": 83, "type": "content",
        "title": "Metricas por Linea de Negocio",
        "bullets": [
            "Profundidad de cola por BU",
            "Agentes asignados a cada linea",
            "Tiempo medio de espera",
            "Cumplimiento SLA por BU"
        ],
        "narration": "El Wallboard tambien muestra metricas por linea de negocio: profundidad de cola, agentes asignados, tiempo medio de espera y cumplimiento de SLA para cada una."
    },
    {
        "num": 84, "type": "content",
        "title": "Estados del Agente",
        "bullets": [
            "Online — Recibiendo conversaciones",
            "Ocupado — Atendiendo cliente",
            "Ausente — En pausa",
            "Offline — Turno terminado"
        ],
        "narration": "Los agentes pueden cambiar su estado en tiempo real: online para recibir conversaciones, ocupado mientras atienden, ausente para pausas, y offline al terminar su turno."
    },
    # SECTION 7: INTEGRACIONES
    {
        "num": 85, "type": "section",
        "section_num": 7,
        "title": "Integraciones Empresariales",
        "narration": "Sarah se integra con los principales sistemas empresariales."
    },
    {
        "num": 86, "type": "content",
        "title": "CRM — Salesforce y HubSpot",
        "bullets": [
            "Salesforce: OAuth2, Lead + Opportunity",
            "HubSpot: API Key, Contact + Deal",
            "Zoho + Pipedrive: adaptadores listos",
            "Envio automatico de cada lead"
        ],
        "narration": "CRM: Salesforce con autenticacion OAuth2 creando Lead y Opportunity, HubSpot con API key creando Contact y Deal, y adaptadores preparados para Zoho y Pipedrive."
    },
    {
        "num": 87, "type": "content",
        "title": "Webhooks — 10 Eventos",
        "bullets": [
            "10 tipos de eventos soportados",
            "Firma HMAC SHA-256",
            "Reintento exponencial (5x)",
            "Proteccion SSRF integrada"
        ],
        "narration": "Los webhooks envian notificaciones a sistemas externos con diez tipos de eventos, firma HMAC SHA256, reintento exponencial hasta cinco veces y proteccion contra SSRF."
    },
    {
        "num": 88, "type": "content",
        "title": "Notificaciones por Email",
        "bullets": [
            "Alerta de escalacion a humano",
            "Solicitud de callback con telefono",
            "Resumen de conversacion completo"
        ],
        "narration": "Las notificaciones por email son tres: alerta de escalacion cuando un visitante pide hablar con un humano, solicitud de llamada con telefono y hora preferida, y resumen de conversacion con toda la transcripcion."
    },
    {
        "num": 89, "type": "content",
        "title": "Plugin WordPress",
        "bullets": [
            "Instalacion como cualquier plugin WP",
            "Pagina de ajustes en admin",
            "API Key, colores, idioma, posicion",
            "Carga automatica en footer"
        ],
        "narration": "El plugin de WordPress se instala como cualquier plugin: tiene pagina de ajustes en el admin con API key, colores, idioma y posicion. Se carga automaticamente en el footer de la web."
    },
    {
        "num": 90, "type": "content",
        "title": "Shopify + Magento",
        "bullets": [
            "Shopify: plantilla Liquid",
            "Magento 2: plantilla PHTML",
            "Integracion con ecommerce completa"
        ],
        "narration": "Tambien hay plantillas para Shopify en formato Liquid y para Magento 2 en formato PHTML, permitiendo la integracion con las principales plataformas de ecommerce."
    },
    # SECTION 8: CIERRE
    {
        "num": 91, "type": "content",
        "title": "Resumen — Solucion Completa",
        "bullets": [
            "Chatbot IA multi-proveedor",
            "VoIP Click to Call integrada",
            "Dashboard de operaciones completo",
            "+10 integraciones empresariales",
            "Deploy con Docker en minutos"
        ],
        "narration": "En resumen, Sarah es una solucion completa: chatbot con inteligencia artificial, comunicaciones de voz VoIP, dashboard de operaciones y mas de diez integraciones. Todo desplegable con Docker en minutos."
    },
    {
        "num": 92, "type": "content",
        "title": "Retorno de Inversion (ROI)",
        "bullets": [
            "-60% tiempos de respuesta",
            "+40% leads capturados",
            "Atencion 24/7 automatizada",
            "4 idiomas sin coste adicional"
        ],
        "narration": "El retorno de inversion es claro: reduccion del 60% en tiempos de respuesta, incremento del 40% en leads capturados, atencion 24/7 automatizada y soporte en 4 idiomas sin coste adicional."
    },
    {
        "num": 93, "type": "cover",
        "title": "Sarah",
        "subtitle": "Chatbot IA Premium — Redegal",
        "narration": "Gracias por ver esta presentacion. Sarah, chatbot con inteligencia artificial premium, desarrollado por Redegal. Para mas informacion, contacte con jorge punto vazquez arroba redegal punto com."
    },
]

# ─── Drawing Functions ────────────────────────────────────────────────────────

def load_fonts():
    """Load all font sizes needed."""
    fonts = {}
    try:
        fonts["title_huge"] = ImageFont.truetype(FONT_BOLD, 80)
        fonts["title_large"] = ImageFont.truetype(FONT_BOLD, 48)
        fonts["title_medium"] = ImageFont.truetype(FONT_BOLD, 36)
        fonts["subtitle"] = ImageFont.truetype(FONT_REGULAR, 32)
        fonts["body"] = ImageFont.truetype(FONT_REGULAR, 24)
        fonts["body_bold"] = ImageFont.truetype(FONT_BOLD, 24)
        fonts["footer"] = ImageFont.truetype(FONT_REGULAR, 16)
        fonts["section_num"] = ImageFont.truetype(FONT_BOLD, 48)
        fonts["small"] = ImageFont.truetype(FONT_REGULAR, 20)
    except Exception as e:
        print(f"Font loading error: {e}")
        sys.exit(1)
    return fonts


def draw_decorative_shapes(draw, slide_type):
    """Draw subtle decorative shapes on the right side."""
    if slide_type == "content":
        # Top-right circle
        draw.ellipse([1720, 60, 1820, 160], fill=(0, 127, 255, 15), outline=None)
        # Mid-right rectangle
        draw.rectangle([1780, 300, 1860, 500], fill=(0, 212, 170, 12), outline=None)
        # Bottom-right circle
        draw.ellipse([1680, 700, 1780, 800], fill=(0, 212, 170, 10), outline=None)
        # Small accent dots
        draw.ellipse([1750, 550, 1770, 570], fill=(0, 127, 255, 20), outline=None)
        draw.ellipse([1820, 620, 1835, 635], fill=(0, 212, 170, 18), outline=None)


def draw_cover_slide(img, draw, fonts, slide):
    """Draw a cover slide (slides 1 and 93)."""
    # Top accent bar
    draw.rectangle([0, 0, WIDTH, 4], fill=ACCENT)

    # Decorative elements
    # Large circle top-right (semi-transparent effect via darker bg color)
    for i in range(3):
        r = 200 - i * 30
        opacity_color = (0, 127, 255)
        x, y = 1600, 150
        # Draw concentric circles with slightly different shades for depth
        shade = tuple(max(0, min(255, BG_COLOR[j] + (opacity_color[j] - BG_COLOR[j]) // (8 + i*3))) for j in range(3))
        draw.ellipse([x-r, y-r, x+r, y+r], fill=shade, outline=None)

    # Small circle bottom-left
    for i in range(2):
        r = 80 - i * 25
        shade = tuple(max(0, min(255, BG_COLOR[j] + (ACCENT[j] - BG_COLOR[j]) // (10 + i*3))) for j in range(3))
        draw.ellipse([200-r, 800-r, 200+r, 800+r], fill=shade, outline=None)

    # "Sarah" title
    title = slide.get("title", "Sarah")
    bbox = fonts["title_huge"].getbbox(title)
    tw = bbox[2] - bbox[0]
    x = (WIDTH - tw) // 2
    draw.text((x, 350), title, fill=WHITE, font=fonts["title_huge"])

    # Subtitle
    subtitle = slide.get("subtitle", "")
    if subtitle:
        bbox = fonts["subtitle"].getbbox(subtitle)
        sw = bbox[2] - bbox[0]
        x = (WIDTH - sw) // 2
        draw.text((x, 460), subtitle, fill=ACCENT, font=fonts["subtitle"])

    # Accent line under subtitle
    line_w = 300
    draw.rectangle([(WIDTH - line_w) // 2, 520, (WIDTH + line_w) // 2, 523], fill=ACCENT)

    # Footer
    footer_text = "Redegal  --  A Smart Digital Company"
    bbox = fonts["footer"].getbbox(footer_text)
    fw = bbox[2] - bbox[0]
    draw.text(((WIDTH - fw) // 2, HEIGHT - 60), footer_text, fill=GRAY_TEXT, font=fonts["footer"])


def draw_section_slide(img, draw, fonts, slide):
    """Draw a section title slide."""
    # Top accent bar
    draw.rectangle([0, 0, WIDTH, 3], fill=ACCENT)

    section_num = slide.get("section_num", 0)

    # Draw large circle with section number
    cx, cy = WIDTH // 2, 350
    r = 60
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=PRIMARY)
    num_text = str(section_num)
    bbox = fonts["section_num"].getbbox(num_text)
    nw = bbox[2] - bbox[0]
    nh = bbox[3] - bbox[1]
    draw.text((cx - nw//2, cy - nh//2 - 5), num_text, fill=WHITE, font=fonts["section_num"])

    # Title
    title = slide.get("title", "")
    bbox = fonts["title_large"].getbbox(title)
    tw = bbox[2] - bbox[0]
    x = (WIDTH - tw) // 2
    draw.text((x, 460), title, fill=WHITE, font=fonts["title_large"])

    # Accent underline
    line_w = 200
    draw.rectangle([(WIDTH - line_w) // 2, 530, (WIDTH + line_w) // 2, 533], fill=ACCENT)

    # Footer
    draw.text((60, HEIGHT - 50), "Sarah -- Redegal", fill=GRAY_TEXT, font=fonts["footer"])
    num_str = f"{slide['num']} / {len(SLIDES)}"
    bbox = fonts["footer"].getbbox(num_str)
    draw.text((WIDTH - 60 - (bbox[2]-bbox[0]), HEIGHT - 50), num_str, fill=GRAY_TEXT, font=fonts["footer"])


def wrap_text(text, font, max_width):
    """Word-wrap text to fit within max_width pixels."""
    words = text.split()
    lines = []
    current_line = ""
    for word in words:
        test = current_line + (" " if current_line else "") + word
        bbox = font.getbbox(test)
        if bbox[2] - bbox[0] <= max_width:
            current_line = test
        else:
            if current_line:
                lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    return lines


def draw_content_slide(img, draw, fonts, slide):
    """Draw a content slide with title and bullet points."""
    # Top accent bar
    draw.rectangle([0, 0, WIDTH, 3], fill=ACCENT)

    # Draw decorative shapes
    draw_decorative_shapes(draw, "content")

    # Title
    title = slide.get("title", "")
    draw.text((100, 70), title, fill=WHITE, font=fonts["title_medium"])

    # Accent line under title
    draw.rectangle([100, 125, 300, 128], fill=ACCENT)

    # Bullet points
    bullets = slide.get("bullets", [])
    y_start = 180
    max_text_width = 1500  # Leave room for decorative elements

    for i, bullet in enumerate(bullets):
        y = y_start + i * 65

        # Bullet dot
        dot_y = y + 10
        draw.ellipse([100, dot_y, 112, dot_y + 12], fill=ACCENT)

        # Check if we need to split bullet into bold prefix + regular text
        if " -- " in bullet:
            parts = bullet.split(" -- ", 1)
            # Bold part
            draw.text((130, y), parts[0], fill=WHITE, font=fonts["body_bold"])
            bbox = fonts["body_bold"].getbbox(parts[0])
            bw = bbox[2] - bbox[0]
            # Separator
            draw.text((130 + bw, y), " -- ", fill=GRAY_TEXT, font=fonts["body"])
            sep_bbox = fonts["body"].getbbox(" -- ")
            sep_w = sep_bbox[2] - sep_bbox[0]
            # Regular part
            draw.text((130 + bw + sep_w, y), parts[1], fill=LIGHT_GRAY, font=fonts["body"])
        elif " -> " in bullet:
            parts = bullet.split(" -> ", 1)
            draw.text((130, y), parts[0], fill=WHITE, font=fonts["body_bold"])
            bbox = fonts["body_bold"].getbbox(parts[0])
            bw = bbox[2] - bbox[0]
            draw.text((130 + bw, y), "  ->  ", fill=ACCENT, font=fonts["body"])
            arr_bbox = fonts["body"].getbbox("  ->  ")
            arr_w = arr_bbox[2] - arr_bbox[0]
            draw.text((130 + bw + arr_w, y), parts[1], fill=LIGHT_GRAY, font=fonts["body"])
        else:
            # Wrap text if needed
            lines = wrap_text(bullet, fonts["body"], max_text_width)
            for li, line in enumerate(lines):
                draw.text((130, y + li * 32), line, fill=LIGHT_GRAY, font=fonts["body"])

    # Footer
    draw.text((60, HEIGHT - 50), "Sarah -- Redegal", fill=GRAY_TEXT, font=fonts["footer"])
    num_str = f"{slide['num']} / {len(SLIDES)}"
    bbox = fonts["footer"].getbbox(num_str)
    draw.text((WIDTH - 60 - (bbox[2]-bbox[0]), HEIGHT - 50), num_str, fill=GRAY_TEXT, font=fonts["footer"])


def generate_slide_image(slide, fonts, output_path):
    """Generate a single slide image."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    slide_type = slide.get("type", "content")

    if slide_type == "cover":
        draw_cover_slide(img, draw, fonts, slide)
    elif slide_type == "section":
        draw_section_slide(img, draw, fonts, slide)
    else:
        draw_content_slide(img, draw, fonts, slide)

    img.save(output_path, "PNG")
    return output_path


# ─── Audio Generation ─────────────────────────────────────────────────────────

async def generate_audio(text, output_path):
    """Generate TTS audio for a narration text."""
    import edge_tts
    communicate = edge_tts.Communicate(text, VOICE, rate=TTS_RATE)
    await communicate.save(output_path)
    return output_path


def get_audio_duration(audio_path):
    """Get duration of an MP3 file in seconds using ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
        capture_output=True, text=True
    )
    return float(result.stdout.strip())


# ─── Video Assembly ───────────────────────────────────────────────────────────

def create_clip(slide_img, audio_file, output_clip, duration):
    """Create a single video clip from image + audio."""
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", slide_img,
        "-i", audio_file,
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        "-t", str(duration + 0.5),  # Small buffer after narration
        output_clip
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_clip


def concatenate_clips(clip_list, output_file, concat_file):
    """Concatenate all clips into final video."""
    # Write concat file
    with open(concat_file, "w") as f:
        for clip in clip_list:
            f.write(f"file '{clip}'\n")

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c", "copy",
        output_file
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_file


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    os.makedirs(TEMP_DIR, exist_ok=True)

    print("=" * 60)
    print("SARAH -- Generador de Video Narrado")
    print("=" * 60)
    print(f"Slides: {len(SLIDES)}")
    print(f"Voz: {VOICE}")
    print(f"Output: {OUTPUT_FILE}")
    print()

    # Load fonts
    print("[1/5] Cargando fuentes...")
    fonts = load_fonts()
    print("  OK - Fuentes cargadas")

    # Generate all slide images
    print(f"\n[2/5] Generando {len(SLIDES)} slides PNG...")
    slide_images = []
    for i, slide in enumerate(SLIDES):
        img_path = os.path.join(TEMP_DIR, f"slide_{i+1:03d}.png")
        generate_slide_image(slide, fonts, img_path)
        slide_images.append(img_path)
        if (i + 1) % 10 == 0 or i == len(SLIDES) - 1:
            print(f"  {i+1}/{len(SLIDES)} slides generados")

    # Generate all audio narrations
    print(f"\n[3/5] Generando {len(SLIDES)} narraciones de audio...")
    audio_files = []
    for i, slide in enumerate(SLIDES):
        audio_path = os.path.join(TEMP_DIR, f"audio_{i+1:03d}.mp3")
        narration = slide.get("narration", "")
        await generate_audio(narration, audio_path)
        audio_files.append(audio_path)
        if (i + 1) % 10 == 0 or i == len(SLIDES) - 1:
            print(f"  {i+1}/{len(SLIDES)} audios generados")

    # Create individual clips
    print(f"\n[4/5] Creando {len(SLIDES)} clips de video...")
    clips = []
    total_duration = 0
    for i in range(len(SLIDES)):
        clip_path = os.path.join(TEMP_DIR, f"clip_{i+1:03d}.mp4")
        duration = get_audio_duration(audio_files[i])
        total_duration += duration + 0.5
        create_clip(slide_images[i], audio_files[i], clip_path, duration)
        clips.append(clip_path)
        if (i + 1) % 10 == 0 or i == len(SLIDES) - 1:
            print(f"  {i+1}/{len(SLIDES)} clips creados")

    print(f"\n  Duracion total estimada: {total_duration/60:.1f} minutos")

    # Concatenate all clips
    print(f"\n[5/5] Concatenando video final...")
    concat_file = os.path.join(TEMP_DIR, "concat.txt")
    concatenate_clips(clips, OUTPUT_FILE, concat_file)

    # Check output
    if os.path.exists(OUTPUT_FILE):
        size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
        print(f"\n{'=' * 60}")
        print(f"VIDEO GENERADO EXITOSAMENTE")
        print(f"  Archivo: {OUTPUT_FILE}")
        print(f"  Tamano: {size_mb:.1f} MB")
        print(f"  Duracion: ~{total_duration/60:.1f} minutos")
        print(f"{'=' * 60}")
    else:
        print("ERROR: No se pudo generar el video final")
        sys.exit(1)

    return size_mb


if __name__ == "__main__":
    result = asyncio.run(main())
