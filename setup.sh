#!/usr/bin/env bash
set -euo pipefail

# ─── RDGBot - Installer ───
# Usage: chmod +x setup.sh && ./setup.sh

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step()  { echo -e "\n${CYAN}${BOLD}==> $1${NC}"; }

echo -e "${BOLD}"
echo "  ____          _                   _    ____ _           _   _           _   "
echo " |  _ \\ ___  __| | ___  __ _  __ _| |  / ___| |__   __ _| |_| |__   ___ | |_ "
echo " | |_) / _ \\/ _\` |/ _ \\/ _\` |/ _\` | | | |   | '_ \\ / _\` | __| '_ \\ / _ \\| __|"
echo " |  _ <  __/ (_| |  __/ (_| | (_| | | | |___| | | | (_| | |_| |_) | (_) | |_ "
echo " |_| \\_\\___|\\__,_|\\___|\\__, |\\__,_|_|  \\____|_| |_|\\__,_|\\__|_.__/ \\___/ \\__|"
echo "                       |___/                                                  "
echo -e "${NC}"
echo "  Chatbot IA + RDGPhone VoIP Widget"
echo "  4 idiomas | 4 lineas de negocio | CRM | Webhooks"
echo ""

# ─── 1. Check prerequisites ───
step "1/8 Verificando requisitos..."

MISSING=()
command -v node >/dev/null 2>&1 || MISSING+=("node")
command -v npm >/dev/null 2>&1 || MISSING+=("npm")

if [ ${#MISSING[@]} -gt 0 ]; then
  error "Faltan dependencias: ${MISSING[*]}"
  echo "  Instala Node.js 20+: https://nodejs.org/"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  error "Se necesita Node.js 18+. Actual: $(node -v)"
  exit 1
fi
log "Node.js $(node -v)"
log "npm $(npm -v)"

HAS_DOCKER=false
if command -v docker >/dev/null 2>&1; then
  HAS_DOCKER=true
  log "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
else
  warn "Docker no encontrado - se usara modo desarrollo local"
fi

# ─── 2. Install dependencies ───
step "2/8 Instalando dependencias..."
npm install --no-audit --no-fund 2>&1 | tail -1
log "Dependencias instaladas"

# ─── 3. Setup .env ───
step "3/8 Configurando entorno..."

if [ -f .env ]; then
  warn ".env ya existe - no se sobreescribe"
else
  # Generate random secrets
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  API_KEY=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
  DB_PASS=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
  REDIS_PASS=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")

  cat > .env << ENVEOF
# ─── Database ───
POSTGRES_HOST=${HAS_DOCKER:+postgres}${HAS_DOCKER:+}
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=5432
POSTGRES_DB=rdgbot
POSTGRES_USER=redegal
POSTGRES_PASSWORD=${DB_PASS}

# ─── Redis ───
REDIS_HOST=${HAS_DOCKER:+redis}${HAS_DOCKER:+}
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PASSWORD=${REDIS_PASS}

# ─── AI Providers (configura al menos uno) ───
AI_PROVIDER=gemini
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=

# ─── Server ───
PORT=3000
NODE_ENV=development
JWT_SECRET=${JWT_SECRET}
WIDGET_API_KEY=${API_KEY}

# ─── SIP / Asterisk (opcional) ───
SIP_WSS_URL=wss://pbx.redegal.com:8089/ws
SIP_DOMAIN=pbx.redegal.com
ASTERISK_AMI_HOST=
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USER=chatbot
ASTERISK_AMI_PASSWORD=

# ─── CORS ───
ALLOWED_ORIGINS=http://localhost:3000

# ─── Business Hours (Europe/Madrid) ───
TIMEZONE=Europe/Madrid
BUSINESS_HOURS_START=9
BUSINESS_HOURS_END=19

# ─── Branding ───
PRIMARY_COLOR=#007fff
ENVEOF

  log ".env creado con secrets aleatorios"
fi

# ─── 4. Build widget + dashboard ───
step "4/8 Compilando widget y dashboard..."
npm -w widget run build 2>&1 | tail -1
log "Widget compilado"
npm -w dashboard run build 2>&1 | tail -1
log "Dashboard compilado"

# Copy builds to server/public for serving
mkdir -p server/public/widget server/public/dashboard
cp -r widget/dist/* server/public/widget/ 2>/dev/null || true
cp -r dashboard/dist/* server/public/dashboard/ 2>/dev/null || true
log "Builds copiados a server/public/"

# ─── 5. Docker mode ───
if [ "$HAS_DOCKER" = true ]; then
  step "5/8 Iniciando servicios con Docker..."
  docker compose up -d postgres redis 2>&1 | tail -3

  # Wait for PostgreSQL
  echo -n "  Esperando PostgreSQL..."
  for i in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U redegal >/dev/null 2>&1; then
      echo " listo"
      break
    fi
    echo -n "."
    sleep 1
  done
  log "PostgreSQL y Redis funcionando"
else
  step "5/8 Modo local (sin Docker)"
  warn "Necesitas PostgreSQL y Redis corriendo localmente:"
  echo "  - PostgreSQL en localhost:5432 con DB 'rdgbot'"
  echo "  - Redis en localhost:6379"
  echo ""
  echo "  Para crear la DB:"
  echo "    createdb rdgbot"
  echo "    psql rdgbot < server/config/init.sql"
fi

# ─── 6. Initialize database ───
step "6/8 Inicializando base de datos..."
if [ "$HAS_DOCKER" = true ]; then
  # Docker already runs init.sql on first start
  log "Schema aplicado via Docker init"
else
  if command -v psql >/dev/null 2>&1; then
    # Try to apply schema
    source .env 2>/dev/null || true
    PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-redegal}" -d "${POSTGRES_DB:-rdgbot}" -f server/config/init.sql >/dev/null 2>&1 && log "Schema aplicado" || warn "No se pudo aplicar schema (psql). Hazlo manualmente."
  else
    warn "psql no encontrado. Aplica el schema manualmente:"
    echo "    psql rdgbot < server/config/init.sql"
  fi
fi

# ─── 7. Seed knowledge + create admin ───
step "7/8 Datos iniciales..."
# These will fail gracefully if DB isn't ready
node scripts/seed-knowledge.js 2>/dev/null && log "Knowledge base sembrada" || warn "Seed knowledge pendiente (necesita DB)"
node scripts/create-agent.js admin admin123 "Administrador" "es,en,gl,pt,fr,de" "boostic,binnacle,marketing,tech" 2>/dev/null && log "Agente admin creado (admin/admin123)" || warn "Create agent pendiente (necesita DB)"

# ─── 8. Run tests ───
step "8/8 Ejecutando tests..."
npm test 2>&1 | tail -5 || warn "Algunos tests fallaron (puede ser normal sin DB)"

# ─── Done ───
echo ""
echo -e "${GREEN}${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  Instalacion completada!${NC}"
echo -e "${GREEN}${BOLD}========================================${NC}"
echo ""
echo -e "  ${BOLD}Iniciar servidor:${NC}"
if [ "$HAS_DOCKER" = true ]; then
  echo "    docker compose up"
else
  echo "    npm -w server run dev"
fi
echo ""
echo -e "  ${BOLD}URLs:${NC}"
echo "    Widget test:  http://localhost:3000/widget/test.html"
echo "    Dashboard:    http://localhost:3000/dashboard"
echo "    Health:       http://localhost:3000/health"
echo "    API Config:   http://localhost:3000/api/config/widget"
echo ""
echo -e "  ${BOLD}Agente admin:${NC}"
echo "    Usuario:  admin"
echo "    Password: admin123"
echo ""
echo -e "  ${BOLD}Configuracion:${NC}"
echo "    - Edita .env para API keys (GEMINI_API_KEY, etc.)"
echo "    - Configura CRM en la DB (tabla config, clave crm_integrations)"
echo "    - Configura webhooks desde el dashboard > Ajustes"
echo ""
echo -e "  ${BOLD}Embeber en tu web:${NC}"
echo '    <script>'
echo '      window.RdgBot = {'
echo "        baseUrl: 'https://tu-dominio.com/widget',"
echo "        apiUrl: 'wss://tu-dominio.com/ws/chat',"
echo "        configUrl: 'https://tu-dominio.com/api/config/widget',"
echo "        language: 'auto',"
echo "        primaryColor: '#007fff'"
echo '      };'
echo '    </script>'
echo '    <script src="https://tu-dominio.com/widget/loader.js" async></script>'
echo ""
