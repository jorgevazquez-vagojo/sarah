// 12-language detector with weighted scoring
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
  fr: {
    strong: ['bonjour', 'merci', 'aide', 'besoin', 'voudrais', 'information', 'entreprise', "s'il vous plaît"],
    words: ['services', 'contact', 'projet', 'prix', 'comment', 'pouvez'],
  },
  de: {
    strong: ['hallo', 'danke', 'hilfe', 'brauche', 'möchte', 'information', 'unternehmen', 'bitte'],
    words: ['dienste', 'kontakt', 'projekt', 'preis', 'können', 'frage'],
  },
  it: {
    strong: ['ciao', 'grazie', 'aiuto', 'bisogno', 'vorrei', 'informazione', 'azienda', 'per favore'],
    words: ['servizi', 'contatto', 'progetto', 'prezzo', 'come', 'potete'],
  },
  nl: {
    strong: ['hallo', 'dank', 'help', 'nodig', 'graag', 'informatie', 'bedrijf', 'alstublieft'],
    words: ['diensten', 'contact', 'project', 'prijs', 'kunt', 'vraag'],
  },
  zh: {
    strong: ['你好', '谢谢', '帮助', '需要', '信息', '公司', '服务', '请问'],
    words: ['项目', '价格', '联系', '咨询', '我想'],
  },
  ja: {
    strong: ['こんにちは', 'ありがとう', '助けて', '必要', '情報', '会社', 'サービス', 'お願い'],
    words: ['プロジェクト', '価格', '連絡', '相談', 'したい'],
  },
  ko: {
    strong: ['안녕하세요', '감사합니다', '도움', '필요', '정보', '회사', '서비스', '부탁'],
    words: ['프로젝트', '가격', '연락', '상담', '하고 싶'],
  },
  ar: {
    strong: ['مرحبا', 'شكرا', 'مساعدة', 'أحتاج', 'معلومات', 'شركة', 'خدمات', 'من فضلك'],
    words: ['مشروع', 'سعر', 'اتصال', 'استشارة', 'أريد'],
  },
};

function detectLanguage(text) {
  if (!text || text.length < 2) return 'es';
  const lower = text.toLowerCase();

  // Quick checks for CJK scripts
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return 'ko';
  if (/[\u0600-\u06ff\u0750-\u077f]/.test(text)) return 'ar';

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
