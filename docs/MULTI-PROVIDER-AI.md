# Soporte Multi-Proveedor de IA

## Visión General

El sistema de chatbot y Click2Call de Redegal soporta **tres proveedores de IA principales** para maximizar disponibilidad y flexibilidad:

- **Claude (Anthropic)** — Proveedor por defecto
- **Gemini (Google)** — Fallback gratuito
- **OpenAI** — Alternativa premium

Esta arquitectura permite **cambiar dinámicamente entre proveedores** cuando uno agota créditos o requiere mantenimiento, sin interrumpir el servicio.

---

## 1. Proveedores Soportados

### Claude (Anthropic) — RECOMENDADO
**Estado**: Proveedor principal y por defecto

**Fortalezas**:
- Mejor comprensión de contexto conversacional
- Respuestas más naturales y coherentes
- Excelente para análisis de intención del usuario
- Soporte superior para múltiples idiomas (4 idiomas soportados)

**Precios** (actualizado 2026):
- Claude 3.5 Sonnet: $3 por millón tokens entrada, $15 por millón salida
- Modelos más antiguos: costos reducidos

**Disponibilidad**: Acceso vía API key de Anthropic (recomendado para producción)

---

### Gemini (Google)
**Estado**: Fallback gratuito

**Fortalezas**:
- Sin costo directo (límites diarios generosos)
- Integración native con Google Cloud Platform
- Bueno para tareas de análisis y generación de resumen

**Limitaciones**:
- Límite diario: ~20 solicitudes gratuitas
- Menos consistente en conversaciones largas
- Soporte de idiomas más limitado que Claude

**Recomendación**: Usar como fallback cuando Claude no esté disponible

---

### OpenAI
**Estado**: Alternativa premium

**Fortalezas**:
- GPT-4 disponible para casos complejos
- Excelente para generación de contenido creativo
- Bien documentado y ampliamente usado

**Limitaciones**:
- Requiere créditos activos
- Costos superiores a Claude para modelos comparables
- Menos optimizado para conversación multiidioma

**Recomendación**: Usar cuando se requiera un modelo específico (ej: GPT-4 para análisis profundo)

---

## 2. Configuración por Variables de Entorno

Todas las configuraciones se manejan mediante variables de entorno. Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```bash
# PROVEEDOR POR DEFECTO (valores: claude | gemini | openai)
AI_PROVIDER=claude

# CLAVES DE API
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxx

# CADENA DE FALLBACK (opcional, por defecto: claude,gemini,openai)
AI_FALLBACK_CHAIN=claude,gemini,openai

# TIMEOUT PARA CAMBIO A FALLBACK (ms, por defecto: 5000)
AI_PROVIDER_TIMEOUT=5000

# MODO DEBUG (optional)
AI_DEBUG=false
```

### Tabla de Variables de Entorno

| Variable | Descripción | Ejemplo | Requerida |
|----------|-------------|---------|-----------|
| `AI_PROVIDER` | Proveedor activo por defecto | `claude` `gemini` `openai` | Sí |
| `ANTHROPIC_API_KEY` | API key de Anthropic | `sk-ant-...` | Si AI_PROVIDER=claude |
| `GEMINI_API_KEY` | API key de Google Gemini | `AIzaSy...` | Si AI_PROVIDER=gemini |
| `OPENAI_API_KEY` | API key de OpenAI | `sk-...` | Si AI_PROVIDER=openai |
| `AI_FALLBACK_CHAIN` | Orden de fallback | `claude,gemini,openai` | No |
| `AI_PROVIDER_TIMEOUT` | Timeout para cambio fallback (ms) | `5000` | No |
| `AI_DEBUG` | Activar logs de debug | `true` `false` | No |

---

## 3. Cadena de Fallback

El sistema implementa un **fallback automático** cuando el proveedor principal falla:

```
Claude (principal)
    ↓ si falla
Gemini (fallback 1)
    ↓ si falla
OpenAI (fallback 2)
    ↓ si falla
Error (después de agotar todos)
```

**Comportamiento**:
1. Se intenta con el proveedor configurado en `AI_PROVIDER`
2. Si no responde en `AI_PROVIDER_TIMEOUT` (ms), se cambia al siguiente
3. Se registra el cambio en logs con timestamp
4. Se reintentan hasta 3 veces antes de reportar error
5. Los errores se notifican al dashboard para monitoreo

**Ejemplo de Log**:
```
[2026-02-20T14:32:10Z] INFO: Switching AI provider: claude → gemini (timeout after 5000ms)
[2026-02-20T14:32:11Z] INFO: Gemini response successful, continuing...
```

---

## 4. Integración en Chatbot

### Flujo de Conversación

```
Usuario escribe → Webhook recibido → Detectar idioma
                                           ↓
                                    Cargar contexto
                                           ↓
                                    IA Provider (configurado)
                                           ↓
                    Generar respuesta conversacional
                                           ↓
                    Aplicar shortcut expansions
                                           ↓
                    Guardar en PostgreSQL (pgvector)
                                           ↓
                    Enviar vía WebSocket al usuario
```

### Usos Específicos en Chatbot

| Función | Proveedor | Detalle |
|---------|-----------|--------|
| **Comprensión de intención** | AI Provider | Analiza intent del usuario |
| **Generación de respuesta** | AI Provider | Respuesta conversacional natural |
| **Análisis de sentimiento** | AI Provider | Detecta emoción para respuesta empática |
| **Contexto conversacional** | AI Provider | Mantiene coherencia en diálogos largos |
| **Múltiples idiomas** | AI Provider | 4 idiomas soportados automáticamente |

---

## 5. Integración en Click2Call (VoIP)

El sistema Click2Call utiliza IA en dos puntos clave:

### 5.1 Speech-to-Text (STT)

```
Micrófono del usuario → Audio stream
                            ↓
                    IA Provider STT
                            ↓
                    Transcripción a texto
                            ↓
                    Paso a conversación IA
```

**Proveedor por defecto**: AI_PROVIDER configurado
- Claude: Mejor transcripción en español y variantes
- Gemini: Fallback si Claude no disponible
- OpenAI: Alternativa si se requiere Whisper específicamente

### 5.2 Generación de Conversación

```
Transcripción STT → IA Provider
                        ↓
            Generar respuesta verbal
                        ↓
            Text-to-Speech → Usuario
```

**Componentes**:
- STT: Convertir audio → texto (mismo proveedor IA)
- Conversación: Generar respuesta (IA Provider)
- TTS: Convertir respuesta → audio (servidor Asterisk)

---

## 6. Cómo Cambiar de Proveedor en Producción

### Cambio Manual (Rápido - 30 segundos)

Si Claude agota créditos:

```bash
# 1. Conectarse al servidor
ssh root@redegal-chatbot-prod

# 2. Editar archivo .env
nano /app/.env

# 3. Cambiar variable
# DE: AI_PROVIDER=claude
# A:  AI_PROVIDER=gemini

# 4. Guardar (Ctrl+O, Enter, Ctrl+X)

# 5. Reiniciar servicio
docker compose restart chatbot-server

# 6. Verificar en logs
docker compose logs -f chatbot-server | grep "AI_PROVIDER\|AI provider"
```

### Cambio Automático via API (Producción)

Endpoint `/api/system/ai-provider` (solo admin):

```bash
curl -X POST http://localhost:3000/api/system/ai-provider \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"provider": "gemini"}'
```

**Respuesta**:
```json
{
  "success": true,
  "previous": "claude",
  "current": "gemini",
  "timestamp": "2026-02-20T14:32:10Z",
  "status": "active"
}
```

### Verificación Post-Cambio

```bash
# En dashboard: Settings → System → AI Provider
# Verificar estado actual y logs

# Vía curl:
curl http://localhost:3000/api/system/ai-provider \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## 7. Estructura de Código

### Localización de Configuración

```
/server/
├── config/
│   └── ai-provider.js          # Configuración central
├── integrations/
│   ├── ai/
│   │   ├── claude.js           # Integración Anthropic
│   │   ├── gemini.js           # Integración Google
│   │   ├── openai.js           # Integración OpenAI
│   │   └── provider-manager.js # Orquestación y fallback
│   └── ...
└── services/
    ├── conversation.js         # Servicio de conversación
    └── click2call.js          # Servicio VoIP/STT
```

### Flujo de Inicialización

```javascript
// En server/index.js o similar:
const AIProvider = require('./integrations/ai/provider-manager');

// Instancia única (singleton)
const aiProvider = AIProvider.getInstance();

// Durante startup:
// 1. Lee AI_PROVIDER de .env
// 2. Carga API keys correspondientes
// 3. Valida conectividad con proveedor
// 4. Configura fallback chain
```

---

## 8. Monitoreo y Alertas

### Métricas Clave

El dashboard muestra en tiempo real:

| Métrica | Descripción | Umbral de Alerta |
|---------|-------------|------------------|
| **Proveedor Activo** | IA provider en uso ahora | Cambio no planeado |
| **Latencia Promedio** | Tiempo respuesta IA (ms) | > 3000ms |
| **Tasa de Error** | % solicitudes fallidas | > 5% |
| **Fallbacks Activados** | Cantidad de cambios automáticos | > 10 por hora |
| **Créditos Disponibles** | Estimado antes de agotar | < 10 solicitudes |

### Logs de Auditoría

Cada cambio de proveedor se registra:

```
Tabla: ai_provider_logs
Columnas:
  - timestamp
  - previous_provider
  - current_provider
  - reason (timeout | manual | credits_exhausted | error)
  - user_id (si es manual)
  - status (success | failed)
```

---

## 9. Troubleshooting

### Problema: Proveedor actual retorna errores

**Solución 1**: Verificar API key
```bash
# En archivo .env o secrets:
echo $ANTHROPIC_API_KEY  # Verificar no esté vacía
```

**Solución 2**: Forzar cambio a fallback
```bash
# Editar .env
AI_PROVIDER=gemini
# Reiniciar
docker compose restart
```

**Solución 3**: Revisar logs
```bash
docker compose logs chatbot-server | grep "AI_PROVIDER\|Error\|error"
```

### Problema: Todos los proveedores fallan

**Pasos**:
1. Verificar conectividad a internet: `curl https://api.anthropic.com`
2. Verificar todas las API keys están correctas
3. Revisar limits/quotas en dashboards de cada proveedor
4. Si persiste: reportar a Devops (ver sección siguiente)

### Problema: Latencia muy alta (>3s)

**Causas comunes**:
- Proveedor sobrecargado (temporario, esperar)
- Red lenta a datacenter de proveedor
- Solicitud demasiado compleja para IA

**Soluciones**:
```bash
# Aumentar timeout si es esperado
AI_PROVIDER_TIMEOUT=10000

# Cambiar a proveedor más rápido (Gemini usualmente más rápido)
AI_PROVIDER=gemini
```

---

## 10. Contactos y Escalaciones

### Equipo Técnico

| Rol | Nombre | Contacto |
|-----|--------|----------|
| Lead Dev Backend | Fernando | (interno) |
| Senior Dev | Gervasio | (interno) |
| DevOps / Infra | (Redegal) | deploy@redegal.net |

### Escalación

**Nivel 1 (Fernando/Gervasio)**:
- Cambio manual de proveedor
- Verificación de configuración
- Debugging de conversación fallida

**Nivel 2 (DevOps)**:
- Problemas de conectividad
- Gestión de secrets/API keys
- Rotación de credenciales

**Nivel 3 (Soporte Proveedor)**:
- Contactar directamente a Anthropic, Google, OpenAI
- Reportar bugs en sus APIs
- Solicitar aumento de quotas

---

## 11. Checklist de Implementación

- [ ] `.env` contiene `AI_PROVIDER=claude`
- [ ] `ANTHROPIC_API_KEY` válida y activa
- [ ] `GEMINI_API_KEY` configurada como fallback
- [ ] `OPENAI_API_KEY` opcional pero recomendada
- [ ] Logs muestran "AI Provider initialized: claude"
- [ ] Dashboard muestra proveedor activo
- [ ] Conversación de prueba funciona en idioma nativo
- [ ] Click2Call STT capta audio correctamente
- [ ] Fallback a Gemini funciona si Claude se desactiva
- [ ] Métricas de latencia visibles en dashboard

---

## 12. Referencias

- **Documentación Anthropic API**: https://docs.anthropic.com
- **Documentación Gemini**: https://ai.google.dev
- **Documentación OpenAI**: https://platform.openai.com/docs
- **Código del Chatbot**: `/server/integrations/ai/`
- **Config de Sistema**: `/server/config/ai-provider.js`

---

## Historial de Cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-02-20 | Documento inicial | Dev Team |
| - | - | - |

---

**Última actualización**: 2026-02-20
**Versión**: 1.0
**Estado**: Producción
