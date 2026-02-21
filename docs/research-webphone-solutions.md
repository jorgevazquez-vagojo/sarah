# Investigacion: Soluciones RDGPhone y WebRTC para Widget Chatbot Redegal

**Fecha**: 2026-02-20
**Objetivo**: Analizar las principales soluciones RDGPhone/RDGPhone del mercado para mejorar nuestro widget RDGPhone integrado en el chatbot Redegal.

---

## 1. IPGlobal / Webphone.net (A Coruna, Espana)

### Empresa
- **Razon social**: Premium Leads, S.L. (antes IP Web Services, S.L.)
- **Ubicacion**: Manuel Murguia S/N, Casa del Agua, Planta 1a, 15011 A Coruna
- **NIF**: B70545843
- **Marca**: Webphone (rdgphone.net) + IPGlobal (ipglobal.es)
- **Reconocimiento**: Premiada en la IV edicion del campus SeedRocket (Barcelona)
- **Plataforma interna**: MARCO (users.rdgphone.net) -- panel de gestion de clientes

### Producto: Click to Call Webphone
**Modelo de negocio**: Boton "click to call" que convierte visitas web en llamadas telefonicas. NO es WebRTC puro en navegador, sino callback telefono-a-telefono.

**Como funciona**:
1. El visitante introduce su numero de telefono en el widget web
2. Webphone llama al visitante a su telefono real
3. Simultaneamente conecta la llamada con el agente/empresa
4. La llamada es telefono-a-telefono (no requiere microfono/auriculares en navegador)

### Funcionalidades clave
| Feature | Descripcion |
|---------|-------------|
| **Click to Call** | Boton web que inicia callback. Gratis para el cliente. |
| **Live Video** | Escalado de llamada a videollamada con compartir pantalla |
| **Live Chat** | Chat integrado con deteccion de agente offline -> formulario |
| **Screen Sharing** | Navegacion asistida durante chat o videollamada |
| **File Transfer** | Transferencia de archivos durante la sesion |
| **Callback scheduling** | Si fuera de horario, captura lead 24/7 y programa callback automatico |
| **Enrutamiento inteligente** | Dirige llamadas segun hora/dia, disponibilidad, codigo pais del visitante |
| **Antispam** | Bloqueo de numeros no deseados |
| **Analytics en tiempo real** | Estadisticas de campanas, equipos, llamadas atendidas/perdidas |
| **Multicanal** | Despliegue en web, eCommerce, RRSS, newsletters, email, QR, SMS |
| **Personalizacion** | Textos, diseno, imagen corporativa, locuciones de bienvenida multi-idioma |
| **Plugin WordPress** | Plugin oficial en wordpress.org |
| **Integracion GA/CRM** | Google Analytics + API para CRM propios |

### Caso de exito: Jazztel
- **Resultado**: 25% tasa de conversion a leads en 40 dominios desplegados
- **Impacto**: Reduccion del 40% en coste de adquisicion de clientes (CAC)
- **Clave**: La cualificacion de leads en tiempo real redujo costes

### Pricing
- **Plan LITE**: Prepago, minimo 50EUR recarga, sin permanencia
- **Plan desde 300 minutos**: Sin compromiso de permanencia
- **Modelo**: Pago por minutos de llamada consumidos

### Puntos fuertes para copiar
- **Callback scheduling automatico** fuera de horario (ya lo tenemos parcialmente)
- **Escalado chat -> voz -> video -> screen sharing** sin perder contexto
- **Widget multicanal** (mismo boton en web, email, QR)
- **Analytics en tiempo real** de llamadas (atendidas, perdidas, conversion)

---

## 2. Twilio Voice SDK (JavaScript)

### Arquitectura
- **SDK**: `@twilio/voice-sdk` (JavaScript, npm)
- **Protocolo**: WebRTC nativo en navegador
- **Conectividad**: Browser <-> Twilio Edge (media servers) <-> PSTN/SIP
- **Seguridad**: DTLS-SRTP obligatorio, tokens JWT por sesion

### Features destacadas
| Feature | Descripcion |
|---------|-------------|
| **Voice Insights** | Analytics de calidad: MOS score, jitter, RTT, packet loss |
| **Network Warnings** | Eventos en tiempo real cuando la calidad cae (warning/cleared) |
| **Audio Level Warnings** | Deteccion de microfono sin audio (muted, desconectado) |
| **Preflight Test** | Test de conectividad pre-llamada para diagnosticar problemas |
| **Codec Selection** | Opus (default) con fallback a PCMU |
| **Echo Cancellation** | AEC nativo del navegador + tuning de Twilio |
| **Noise Suppression** | Filtrado de ruido ambiente automatico |
| **Call Recording** | Grabacion en la nube con webhook de notificacion |
| **DTMF** | Envio de tonos durante la llamada |
| **Custom Parameters** | Metadata arbitraria adjunta a cada llamada |
| **Dashboard Analytics** | Metricas agregadas por browser, version, region |

### Voice Insights -- Metricas de calidad
```javascript
// Eventos de warning que dispara el SDK
call.on('warning', (warningName, warningData) => {
  // warningName: 'high-rtt', 'low-mos', 'high-jitter', 'high-packet-loss'
  showQualityWarning(warningName); // Mostrar al usuario
});

call.on('warning-cleared', (warningName) => {
  hideQualityWarning(warningName);
});
```

### Innovaciones para copiar
- **Preflight test**: antes de marcar, verificar que WebRTC funciona (STUN/TURN, microfono, codec)
- **Indicador visual de calidad en tiempo real**: barra de senal o icono que cambie segun MOS
- **Audio level warnings**: detectar microfono silenciado y avisar al usuario
- **Custom metadata**: pasar datos del chat (idioma, BU, lead score) a la llamada

---

## 3. Vonage (ex-Nexmo) In-App Voice

### Arquitectura
- **SDK**: JavaScript, iOS, Android
- **Protocolo**: WebRTC + SIP interworking
- **Backend**: Vonage Voice API (NCCO scripts)

### Features destacadas
| Feature | Descripcion |
|---------|-------------|
| **Click-to-Call global** | Conectividad WebRTC -> PSTN en 100+ paises |
| **TTS multilingue** | Text-to-Speech en multiples idiomas y acentos |
| **ASR** | Reconocimiento de voz en 120+ idiomas |
| **Bridge IP-PSTN** | Puente bidireccional entre llamada IP y telefonica |
| **Conferencia** | Llamadas grupales con moderador |
| **AI Bots** | Integracion con bots IA en tiempo real durante la llamada |
| **Event Capture** | Timestamps, member ID, user ID de cada evento |
| **Quality Data** | Captura de metricas de calidad y senalizacion |

### Innovaciones para copiar
- **ASR integration**: transcripcion en tiempo real durante la llamada (para el agente)
- **AI Bot en llamada**: el bot IA podria atender la llamada inicial y transferir a humano
- **TTS multi-idioma**: saludos automaticos en el idioma del visitante

---

## 4. Plivo Browser SDK

### Arquitectura
- **SDK**: `plivo-browser-sdk` (npm)
- **PHLO**: Low-code orchestration para call flows
- **Protocolo**: WebRTC con fallback

### Features destacadas
| Feature | Descripcion |
|---------|-------------|
| **Click-to-Call PHLO** | Flujo visual: visitor introduce num -> PBX llama a ambos lados |
| **Live Quality Metrics** | Metricas de calidad mostradas en tiempo real durante llamada |
| **Call Logging** | Registro completo de llamadas con metadata |
| **Feedback API** | Envio de feedback de calidad post-llamada |
| **Browser + PSTN** | Llamadas a numeros PSTN y direcciones SIP |

### Innovaciones para copiar
- **Metricas de calidad visibles durante la llamada**: mostrar al usuario la calidad de la conexion
- **Feedback post-llamada**: CSAT especifico de la llamada (ya tenemos CSAT de chat, extenderlo)

---

## 5. Telnyx WebRTC SDK

### Arquitectura
- **SDK**: `@telnyx/webrtc` (npm, open source)
- **Red**: Red privada global propia (baja latencia)
- **Protocolo**: WebRTC con SIP signaling

### Features destacadas
| Feature | Descripcion |
|---------|-------------|
| **Red privada** | Latencia baja y calidad consistente vs internet publico |
| **Transcripcion en tiempo real** | Speech-to-text durante la llamada |
| **Programmable Call Control** | Control de llamada via API (hold, transfer, record) |
| **Call Recording** | Grabacion con webhook |
| **Audio Visualization** | Visualizacion de audio (waveform/spectrum) |
| **Call History** | Historial de llamadas integrado |
| **Open Source** | SDK totalmente open source en GitHub |

### Innovaciones para copiar
- **Audio visualization**: waveform animado que muestra el audio en tiempo real (UX premium)
- **Transcripcion en tiempo real**: mostrar texto de lo que dice el interlocutor (accesibilidad)
- **Call history**: historial de llamadas previas del visitante

---

## 6. 3CX RDGPhone

### Arquitectura
- **Tipo**: PBX completa con WebRTC web client integrado
- **Protocolo**: WebRTC propio (no JsSIP/SIP.js standard), stack SIP propio
- **Deploy**: On-premise o cloud

### Features destacadas
| Feature | Descripcion |
|---------|-------------|
| **Zero-install** | Llamada desde el navegador sin instalar nada |
| **Click-to-Call widget** | Widget embebible en web que conecta con la PBX |
| **Video + Screen Sharing** | Escalado de voz a video con compartir pantalla |
| **Web Meetings** | Reuniones WebRTC sin plugins |
| **Live Chat integrado** | Chat en web con escalado a llamada |
| **CRM integration** | Salesforce, HubSpot, Zendesk, etc. |
| **Mobile + Desktop** | Apps nativas ademas del web client |
| **Queue Management** | Colas con musica de espera y anuncios de posicion |

### Innovaciones para copiar
- **Anuncio de posicion en cola**: "Eres el 2o en la cola, tiempo estimado: 2 minutos"
- **Escalado fluido chat -> voz -> video -> screen sharing**
- **Widget configurable** sin instalacion

---

## 7. Asterisk/FreePBX + Browser Phone (Open Source)

### Arquitectura
- **Proyecto**: [InnovateAsterisk/Browser-Phone](https://github.com/InnovateAsterisk/Browser-Phone)
- **Stack**: SIP.js + Asterisk PJSIP + WebSocket Secure (wss:8089)
- **Protocolo**: SIP sobre WebSocket + WebRTC media

### Features destacadas
| Feature | Descripcion |
|---------|-------------|
| **Llamadas audio/video** | Audio y video con grabacion (5 layouts, 3 calidades) |
| **Sin cloud** | Totalmente standalone, sin servicios externos |
| **Cross-browser** | Chrome, Edge, Opera (full), Firefox, Safari (most) |
| **SIP.js** | Libreria JavaScript madura para SIP sobre WebSocket |
| **Registracion WebRTC** | Se registra como extension en Asterisk via WSS |
| **Contactos** | Agenda con click-to-call desde contactos |
| **Offline capable** | Librerias pueden servirse localmente |

### Config Asterisk requerida
```ini
; pjsip.conf - Extension WebRTC
[webrtc_extension]
type=endpoint
transport=transport-wss
context=from-internal
disallow=all
allow=opus
allow=ulaw
dtls_auto_generate_cert=yes
webrtc=yes
```

### Relevancia para nuestro proyecto
Nuestro backend SIP actual (`sip-rdgphone.js`) usa UDP raw contra Vozelia. La alternativa seria usar SIP.js en el navegador directamente contra un Asterisk/FreePBX con WebSocket, lo que daria control total del audio WebRTC.

---

## 8. Sinch

### Features destacadas
| Feature | Descripcion |
|---------|-------------|
| **Codecs adaptativos** | Audio/video codecs que se ajustan segun red |
| **E2E encryption** | Cifrado extremo a extremo (ISO 27001, GDPR) |
| **UI customizable** | SDK permite brandear toda la UI de llamada |
| **HD Voice** | Calidad HD con Opus codec |
| **Global CDN** | Red de media servers distribuida |

---

## 9. Infobip WebRTC SDK 2.0

### Features destacadas
| Feature | Descripcion |
|---------|-------------|
| **Video/Audio Filters** | Background blur + noise filtering desde JS |
| **Rooms** | Salas de conferencia WebRTC |
| **Recording** | Grabacion de sesiones WebRTC |
| **Multi-platform SDK** | JS, Android, iOS |
| **Extensions library** | Libreria de extensiones para filtros avanzados |

### Innovaciones para copiar
- **Background blur**: util si se escala a video (privacidad del visitante)
- **Noise filtering en JS**: reduccion de ruido ambiente client-side

---

## 10. Zoiper Web Client

### Features destacadas
| Feature | Descripcion |
|---------|-------------|
| **Zero-UI mode** | Puede funcionar sin interfaz visible (API pura) |
| **Concurrent calls** | Llamadas concurrentes ilimitadas |
| **API potente** | Provisioning, customization, integracion rapida |
| **Hold + Transfer** | Funciones basicas de centralita |
| **Browser extensions** | Extension Chrome para click-to-call en cualquier web |
| **No requiere instalacion** | Plugin de navegador auto-detectado |

---

## 11. Vozelia (ahora Sewan)

### Estado actual
- **Adquisicion**: Vozelia fue adquirida por Sewan Groupe (Francia)
- **Marca**: Ahora opera como "Sewan Comunicaciones"
- **Plataforma**: "Sophia" (All-In-One: config, auto-provisioning, facturacion)
- **Relevancia**: Es nuestra PBX actual (cloudpbx1584.vozelia.com)

### Limitaciones conocidas
- **No expone AMI** (es cloud PBX, no Asterisk accesible)
- **SIP standard** sobre UDP/TCP (nuestro `sip-rdgphone.js` ya lo maneja)
- **No WebSocket SIP** nativo (limitacion para WebRTC directo desde browser)

---

## 12. Bandwidth

### Estado (2026)
- **WebRTC API deprecated** desde mayo 2023
- **Nuevo producto**: "In-App Calling" (simplificado)
- **Nota**: No recomendable como referencia por el deprecation

---

## 13. Otros proveedores notables

### AudioCodes (WebRTC Click-to-Call Widget)
- Widget corporativo con guia de instalacion/configuracion detallada
- Orientado a contact centers enterprise

### Thirdlane
- WebCall Widgets asociados a colas/IVRs
- Control de acceso por IP

### Deltapath
- Click-to-Call WebRTC para customer service
- Screen sharing en la misma sesion

### Voximplant
- Click-to-call cloud con SDK JavaScript
- Serverless call control

---

## 14. Analisis Tecnico: WebRTC Seguridad y Calidad

### Seguridad (OBLIGATORIO en WebRTC)

```
WebRTC Security Stack:
+----------------------------------+
| Application Layer                |
+----------------------------------+
| SRTP (media encryption)          |  <- Cifrado de audio/video
+----------------------------------+
| DTLS (key exchange)              |  <- Intercambio de claves
+----------------------------------+
| ICE/STUN/TURN (connectivity)     |  <- NAT traversal
+----------------------------------+
| UDP/TCP Transport                |
+----------------------------------+
```

**Puntos clave**:
- **DTLS-SRTP es obligatorio**: WebRTC lo impone, no se puede desactivar
- **Claves por media plane**: Las claves se intercambian por DTLS, no por SDP (mas seguro que SRTP puro)
- **Certificate pinning**: El fingerprint del certificado DTLS se incluye en el SDP
- **Browsers auto-update**: Los navegadores se actualizan automaticamente, manteniendo la seguridad

### Metricas de Calidad (WebRTC getStats API)

```javascript
// Obtener estadisticas de la conexion
const stats = await peerConnection.getStats();

stats.forEach(report => {
  if (report.type === 'inbound-rtp' && report.kind === 'audio') {
    console.log('Jitter:', report.jitter);
    console.log('Packets Lost:', report.packetsLost);
    console.log('Bytes Received:', report.bytesReceived);
  }
  if (report.type === 'remote-inbound-rtp') {
    console.log('Round Trip Time:', report.roundTripTime);
  }
  if (report.type === 'candidate-pair' && report.state === 'succeeded') {
    console.log('Current RTT:', report.currentRoundTripTime);
  }
});
```

**Metricas clave**:
| Metrica | Bueno | Aceptable | Malo |
|---------|-------|-----------|------|
| RTT (latencia) | < 150ms | 150-300ms | > 300ms |
| Jitter | < 30ms | 30-50ms | > 50ms |
| Packet Loss | < 1% | 1-3% | > 3% |
| MOS Score | > 4.0 | 3.5-4.0 | < 3.5 |

### Codecs de Audio

| Codec | Bitrate | Calidad | Soporte |
|-------|---------|---------|---------|
| **Opus** (obligatorio) | 6-510 kbps | Excelente, adaptativo | Todos los browsers |
| PCMU (G.711) | 64 kbps | Buena, legacy | Todos |
| PCMA (G.711) | 64 kbps | Buena, legacy | Todos |

**Opus features**:
- Bitrate adaptativo segun condiciones de red
- DTX (Discontinuous Transmission): ahorra ancho de banda en silencio
- FEC (Forward Error Correction): correccion de errores sin retransmision
- Rango: 8kHz (voz) a 48kHz (musica HD)

### Echo Cancellation y Noise Suppression

WebRTC incluye de serie:
- **AEC** (Acoustic Echo Cancellation): el mejor es el de Google WebRTC
- **AGC** (Automatic Gain Control): normaliza volumen automaticamente
- **NS** (Noise Suppression): reduce ruido de fondo
- **VAD** (Voice Activity Detection): detecta cuando se habla

```javascript
// Configurar constraints de audio optimizados
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    // Avanzados (Chrome)
    googEchoCancellation: true,
    googAutoGainControl: true,
    googNoiseSuppression: true,
    googHighpassFilter: true,
  }
});
```

---

## 15. PLAN DE MEJORAS PARA NUESTRO WEBPHONE

### Estado actual de nuestro widget (`/Users/jorgevazquez/rdgbot/`)

**Lo que ya tenemos**:
- `widget/src/lib/sip-client.ts` -- Cliente WebRTC con signaling via WebSocket
- `server/services/sip-rdgphone.js` -- SIP UDP contra Vozelia (REGISTER + INVITE + REFER)
- `server/ws/sip-signaling.js` -- WebSocket signaling bridge
- CallView en Widget con formulario de telefono y estados basicos
- Integracion con colas de negocio (boostic, binnacle, marketing, tech)

**Lo que falta/mejorar**:

### PRIORIDAD ALTA (implementar ya)

#### A1. Indicador visual de calidad de llamada en tiempo real
**Inspirado en**: Twilio Voice Insights, Plivo Live Quality Metrics
```
Implementar en sip-client.ts:
- Poll getStats() cada 2 segundos durante llamada activa
- Calcular MOS estimado a partir de RTT, jitter, packet loss
- Mostrar icono de senal (1-5 barras) en CallView
- Warning visual cuando calidad baja (barra roja pulsante)
```

#### A2. Preflight test de conectividad
**Inspirado en**: Twilio Preflight
```
Antes de iniciar la llamada:
1. Verificar acceso a microfono (getUserMedia)
2. Test STUN/TURN connectivity
3. Test de ancho de banda basico (ping)
4. Mostrar resultado: "Tu conexion es buena para llamar"
5. Si falla: ofrecer alternativa callback (como IPGlobal)
```

#### A3. Estados de llamada con feedback visual mejorado
**Inspirado en**: 3CX, iOS call UI, Ramotion design concepts
```
Estados con animaciones distintas:
- idle: icono telefono estatico
- preflight: testing... (spinner discreto)
- calling: pulso outgoing (anillos expandiendose)
- ringing: animacion ring (vibration pattern)
- queued: posicion en cola + tiempo estimado
- connected: waveform verde + timer + indicador calidad
- on-hold: icono pausado con musica visual
- ended: checkmark + duracion + prompt CSAT
- error: X roja con mensaje y retry
```

#### A4. Audio level monitoring
**Inspirado en**: Twilio Audio Level Warnings
```
- Detectar si el microfono no captura audio (muted, desconectado)
- Mostrar warning: "No detectamos tu voz. Comprueba el microfono."
- Indicador visual de nivel de audio (micro con barras)
```

### PRIORIDAD MEDIA (proximas iteraciones)

#### B1. Callback scheduling (fuera de horario)
**Inspirado en**: IPGlobal/Webphone.net
```
Cuando fuera de horario de atencion:
- Mostrar formulario: nombre + telefono + preferencia horaria
- Guardar en BD como lead con tipo "callback_request"
- Email al agente con los datos
- (Futuro: llamada automatica cuando el agente inicie turno)
```

#### B2. Posicion en cola y tiempo estimado
**Inspirado en**: 3CX Queue Management
```
- El servidor calcula posicion del visitante en la cola de la BU
- WebSocket push: { queuePosition: 2, estimatedWait: "~2 min" }
- Widget muestra: "Eres el 2o en la cola. Tiempo estimado: 2 minutos"
- Actualizacion cada 15 segundos
```

#### B3. Transcripcion en tiempo real (accesibilidad)
**Inspirado en**: Telnyx, Vonage ASR
```
- Usar Web Speech API (browser-native, gratis) para STT
- Mostrar subtitulos en el CallView durante la llamada
- Util para accesibilidad (discapacidad auditiva)
- Util para el agente (ver lo que dice el visitante en dashboard)
```

#### B4. CSAT de llamada especifico
**Inspirado en**: Plivo Feedback API
```
Al terminar la llamada:
- Mostrar stars rating (1-5) especifico de la llamada
- Campos: calidad audio + resolucion del problema + amabilidad
- Guardar en analytics con call_id vinculado
```

#### B5. Call recording con consentimiento
**Inspirado en**: Twilio, Telnyx
```
- Antes de grabar: "Esta llamada puede ser grabada para calidad..."
- Icono REC visible durante grabacion
- Grabacion almacenada en servidor (ya tenemos call-recording.js)
- Accesible desde dashboard con reproductor
```

### PRIORIDAD BAJA (premium roadmap)

#### C1. Escalado a video
**Inspirado en**: IPGlobal Live Video, 3CX, Deltapath
```
- Boton "Activar video" durante llamada de voz
- Renegociar SDP para anadir video track
- Vista picture-in-picture para el visitante
- Screen sharing opcional
```

#### C2. Co-browsing / Navegacion asistida
**Inspirado en**: IPGlobal, IVRPowers
```
- El agente puede ver la pagina del visitante (DOM sharing)
- Puede resaltar elementos en la pagina del visitante
- Util para guiar compras o formularios complejos
```

#### C3. Audio visualization (waveform)
**Inspirado en**: Telnyx
```
- Web Audio API: AnalyserNode con getByteFrequencyData()
- Canvas o SVG con waveform animado durante la llamada
- Da sensacion premium y feedback visual de que el audio funciona
```

#### C4. DTMF durante llamada
**Inspirado en**: Twilio
```
- Teclado numerico overlay para introducir tonos DTMF
- Util para IVRs del lado del agente
- RTCDTMFSender via WebRTC
```

#### C5. Historial de llamadas del visitante
**Inspirado en**: Telnyx
```
- Almacenar historial de llamadas previas del visitor_id
- Mostrar en el widget: "Tu ultima llamada fue hace 3 dias"
- El agente ve el historial completo en dashboard
```

---

## 16. COMPARATIVA RESUMEN

| Proveedor | Tipo | WebRTC Nativo | RDGPhone | Video | Screen Share | STT | Precio |
|-----------|------|:---:|:---:|:---:|:---:|:---:|--------|
| **IPGlobal/Webphone** | Callback | No | Si | Si | Si | No | Desde 50EUR prepago |
| **Twilio** | CPaaS | Si | Si | Si | No | Si (add-on) | $0.013/min |
| **Vonage** | CPaaS | Si | Si | Si | No | Si (120 idiomas) | $0.015/min |
| **Plivo** | CPaaS | Si | Si | No | No | No | $0.010/min |
| **Telnyx** | CPaaS | Si | Si | Si | No | Si | $0.010/min |
| **3CX** | PBX | Si | Si | Si | Si | No | Desde gratis |
| **Sinch** | CPaaS | Si | Si | Si | No | No | Custom |
| **Infobip** | CPaaS | Si | Si | Si | No | No | Custom |
| **Asterisk/Browser-Phone** | Open Source | Si | Si | Si | No | No | Gratis |
| **Zoiper** | Softphone | Si | Si | Si | No | No | Custom |
| **Vozelia/Sewan** | Cloud PBX | No WSS | Si (SIP) | No | No | No | Incluido PBX |
| **Nuestro widget** | Custom | Si (basico) | Si (SIP) | No | No | No | N/A |

---

## 17. RECOMENDACIONES CONCRETAS DE IMPLEMENTACION

### Fase inmediata (sprint actual)

1. **Mejorar `sip-client.ts`**:
   - Anadir `getStats()` polling durante llamada activa
   - Emitir eventos de calidad al Widget (MOS, jitter, packet loss)
   - Anadir audio constraints optimizados (echoCancellation, noiseSuppression, AGC)
   - Implementar reconnection logic (ICE restart)

2. **Mejorar CallView en `Widget.tsx`**:
   - Indicador de senal (1-5 barras) basado en MOS
   - Timer de duracion de llamada
   - Warning de microfono silenciado
   - Estados visuales mas ricos (animaciones por estado)
   - Boton mute/unmute con feedback visual

3. **Anadir preflight test**:
   - Test rapido de 2 segundos antes de iniciar llamada
   - Verificar microfono + STUN connectivity
   - Fallback a callback telefonico si WebRTC no disponible

### Fase siguiente (proximo sprint)

4. **Queue position display** en server/ws/sip-signaling.js
5. **Callback scheduling** para fuera de horario
6. **CSAT de llamada** post-colgar
7. **Audio visualization** (waveform canvas)

### Fase premium (roadmap Q2)

8. **Video escalation** (add video track a sesion existente)
9. **Screen sharing** (getDisplayMedia)
10. **Transcripcion en tiempo real** (Web Speech API)
11. **Co-browsing** (DOM sharing)
12. **Call history** por visitor_id

---

## 18. CODIGO DE REFERENCIA: Audio Quality Monitor

```typescript
// Propuesta para anadir a sip-client.ts
interface CallQualityMetrics {
  mos: number;           // 1.0 - 5.0
  rtt: number;           // ms
  jitter: number;        // ms
  packetLoss: number;    // percentage
  audioLevel: number;    // 0.0 - 1.0
  signal: 1 | 2 | 3 | 4 | 5; // bars
}

function calculateMOS(rtt: number, jitter: number, packetLoss: number): number {
  // E-model simplified (ITU-T G.107)
  const effectiveLatency = rtt + jitter * 2 + 10;
  let R = 93.2;

  if (effectiveLatency < 160) {
    R -= effectiveLatency / 40;
  } else {
    R -= (effectiveLatency - 120) / 10;
  }

  R -= packetLoss * 2.5;
  R = Math.max(0, Math.min(100, R));

  // R to MOS conversion
  const mos = 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7e-6;
  return Math.round(mos * 10) / 10;
}

function mosToSignal(mos: number): 1 | 2 | 3 | 4 | 5 {
  if (mos >= 4.3) return 5;
  if (mos >= 4.0) return 4;
  if (mos >= 3.6) return 3;
  if (mos >= 3.1) return 2;
  return 1;
}

async function pollQuality(pc: RTCPeerConnection): Promise<CallQualityMetrics | null> {
  const stats = await pc.getStats();
  let rtt = 0, jitter = 0, packetLoss = 0, audioLevel = 0;

  stats.forEach(report => {
    if (report.type === 'remote-inbound-rtp' && report.kind === 'audio') {
      rtt = (report.roundTripTime || 0) * 1000;
    }
    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
      jitter = (report.jitter || 0) * 1000;
      const total = (report.packetsReceived || 0) + (report.packetsLost || 0);
      packetLoss = total > 0 ? ((report.packetsLost || 0) / total) * 100 : 0;
      audioLevel = report.audioLevel || 0;
    }
  });

  const mos = calculateMOS(rtt, jitter, packetLoss);
  return { mos, rtt, jitter, packetLoss, audioLevel, signal: mosToSignal(mos) };
}
```

---

## 19. CONCLUSIONES

1. **IPGlobal/Webphone.net** es relevante como referencia de negocio (modelo callback, analytics de conversion, caso Jazztel), pero tecnologicamente es mas simple que lo que nosotros hacemos con WebRTC.

2. **Twilio Voice Insights** es el gold standard en metricas de calidad de llamada. Su patron de network warnings + audio level warnings debemos implementarlo.

3. **3CX** es la mejor referencia para UX de cola de espera (posicion + tiempo estimado) y para el flujo de escalado chat -> voz -> video.

4. **Telnyx** destaca por la visualizacion de audio (waveform) y transcripcion en tiempo real, features que dan sensacion premium.

5. **Nuestro widget ya tiene una base solida** (WebRTC client + SIP backend + estados basicos). Las mejoras mas impactantes son:
   - **Indicador de calidad en tiempo real** (bajo esfuerzo, alto impacto visual)
   - **Preflight test** (mejora fiabilidad dramaticamente)
   - **Audio level warnings** (reduce frustracion del usuario)
   - **Queue position** (reduce abandono de llamada en cola)
   - **Callback scheduling** (captura leads 24/7)

6. **Diferenciador clave**: Ningun competidor tiene un chatbot IA + RDGPhone + dashboard de agentes integrado en un solo widget. Esa es nuestra ventaja competitiva.
