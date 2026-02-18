const PATTERNS = {
  gl: {
    words: ['ola', 'bos', 'grazas', 'axuda', 'quero', 'podo', 'gustaría', 'aquí', 'hoxe', 'noite', 'tamén', 'necesito', 'quería', 'información', 'empresa', 'servizos', 'traballo', 'dixital'],
    strong: ['ñ', 'nh', 'lh', 'podo', 'grazas', 'benvido', 'hoxe', 'noite'],
  },
  'es-MX': {
    words: ['órale', 'chido', 'neta', 'mande', 'ahorita', 'güey', 'platicar', 'padre', 'chamaco', 'jalar', 'chamba'],
    strong: ['órale', 'güey', 'ahorita', 'mande', 'neta'],
  },
  en: {
    words: ['hello', 'help', 'want', 'need', 'would', 'like', 'about', 'services', 'company', 'please', 'thanks', 'information', 'looking', 'contact', 'business'],
    strong: ['the', 'would', 'looking', 'please', 'thanks', 'hello', 'about'],
  },
  es: {
    words: ['hola', 'ayuda', 'quiero', 'necesito', 'información', 'empresa', 'servicios', 'gracias', 'buenas', 'por favor', 'contacto'],
    strong: ['hola', 'gracias', 'buenas', 'por favor'],
  },
};

function detectLanguage(text) {
  if (!text || text.length < 2) return 'es';
  const lower = text.toLowerCase().normalize('NFD');
  const words = lower.split(/\s+/);

  const scores = {};
  for (const [lang, { words: langWords, strong }] of Object.entries(PATTERNS)) {
    scores[lang] = 0;
    for (const w of words) {
      const clean = w.replace(/[^a-záéíóúüñ]/g, '');
      if (strong.includes(clean)) scores[lang] += 3;
      else if (langWords.includes(clean)) scores[lang] += 1;
    }
  }

  // Galician vs Spanish: galician needs strong signals (otherwise default to Spanish)
  if (scores.gl > 0 && scores.gl >= scores.es) return 'gl';

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best[1] === 0) return 'es'; // Default to Spanish
  return best[0];
}

module.exports = { detectLanguage };
