// 6-language detector with weighted scoring (es, en, pt, gl, de, it)
const PATTERNS = {
  gl: {
    strong: ['podo', 'grazas', 'benvido', 'hoxe', 'noite', 'tamén', 'axuda', 'gustaría', 'servizos', 'dixital'],
    words: ['ola', 'bos', 'quero', 'aquí', 'necesito', 'quería', 'información', 'empresa', 'traballo'],
  },
  es: {
    strong: ['hola', 'gracias', 'buenas', 'ayuda', 'necesito', 'quiero', 'información', 'por favor'],
    words: ['empresa', 'servicios', 'contacto', 'consulta', 'presupuesto', 'precio', 'proyecto'],
  },
  en: {
    strong: ['hello', 'thanks', 'please', 'would', 'looking', 'about', 'need', 'help', 'information'],
    words: ['company', 'services', 'contact', 'business', 'project', 'pricing', 'want'],
  },
  pt: {
    strong: ['olá', 'obrigado', 'ajuda', 'preciso', 'gostaria', 'informação', 'por favor', 'empresa'],
    words: ['serviços', 'contato', 'negócio', 'projeto', 'preço', 'quero'],
  },
  de: {
    strong: ['hallo', 'danke', 'bitte', 'hilfe', 'guten', 'ich', 'möchte', 'könnte', 'brauche', 'unternehmen'],
    words: ['dienste', 'kontakt', 'projekt', 'preis', 'angebot', 'mehr', 'informationen', 'website'],
  },
  it: {
    strong: ['ciao', 'grazie', 'salve', 'buongiorno', 'aiuto', 'vorrei', 'bisogno', 'informazioni', 'per favore'],
    words: ['azienda', 'servizi', 'contatto', 'progetto', 'prezzo', 'preventivo', 'sito'],
  },
};

function detectLanguage(text) {
  if (!text || text.length < 2) return 'es';
  const lower = text.toLowerCase();

  const words = lower.split(/\s+/);
  const scores = {};

  for (const [lang, { strong, words: langWords }] of Object.entries(PATTERNS)) {
    scores[lang] = 0;
    for (const w of words) {
      const clean = w.replace(/[^\p{L}\p{N}]/gu, '');
      if (!clean || clean.length < 2) continue;
      // Exact match for short words (< 4 chars), substring for longer
      const match = clean.length < 4
        ? (s) => clean === s || s === clean
        : (s) => clean.includes(s) || s.includes(clean);
      if (strong.some(match)) scores[lang] += 3;
      else if (langWords.some(match)) scores[lang] += 1;
    }
  }

  // Galician needs strong signal (otherwise defaults to Spanish)
  if (scores.gl > 0 && scores.gl >= scores.es) return 'gl';

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] === 0 ? 'es' : best[0];
}

module.exports = { detectLanguage };
