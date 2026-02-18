const { detectLanguage } = require('../services/language-detector');

describe('Language Detector', () => {
  describe('Script-based detection', () => {
    test('detects Chinese from CJK characters', () => {
      expect(detectLanguage('你好，我需要帮助')).toBe('zh');
    });

    test('detects Japanese from hiragana/katakana', () => {
      expect(detectLanguage('こんにちは、サービスについて')).toBe('ja');
    });

    test('detects Korean from hangul', () => {
      expect(detectLanguage('안녕하세요 도움이 필요합니다')).toBe('ko');
    });

    test('detects Arabic from Arabic script', () => {
      expect(detectLanguage('مرحبا أحتاج مساعدة')).toBe('ar');
    });
  });

  describe('Keyword-based detection', () => {
    test('detects Spanish', () => {
      expect(detectLanguage('Hola, necesito información sobre los servicios')).toBe('es');
    });

    test('detects English', () => {
      expect(detectLanguage('Hello, I need help with your services please')).toBe('en');
    });

    test('detects Portuguese', () => {
      expect(detectLanguage('Olá, preciso de ajuda com informação')).toBe('pt');
    });

    test('detects French', () => {
      expect(detectLanguage('Bonjour, j\'ai besoin d\'aide s\'il vous plaît')).toBe('fr');
    });

    test('detects German', () => {
      expect(detectLanguage('Hallo, ich brauche Hilfe bitte')).toBe('de');
    });

    test('detects Italian', () => {
      expect(detectLanguage('Ciao, ho bisogno di aiuto per favore')).toBe('it');
    });

    test('detects Dutch', () => {
      expect(detectLanguage('Hallo, ik heb informatie nodig alstublieft')).toBe('nl');
    });

    test('detects Galician with strong signal', () => {
      expect(detectLanguage('Benvido, necesito axuda cos servizos dixitais')).toBe('gl');
    });
  });

  describe('Edge cases', () => {
    test('returns "es" for empty string', () => {
      expect(detectLanguage('')).toBe('es');
    });

    test('returns "es" for null', () => {
      expect(detectLanguage(null)).toBe('es');
    });

    test('returns "es" for undefined', () => {
      expect(detectLanguage(undefined)).toBe('es');
    });

    test('returns "es" for single character', () => {
      expect(detectLanguage('a')).toBe('es');
    });

    test('returns "es" for unrecognizable text', () => {
      expect(detectLanguage('xyz abc 123')).toBe('es');
    });

    test('handles mixed scripts - CJK takes priority', () => {
      expect(detectLanguage('Hello 你好')).toBe('zh');
    });
  });

  describe('Galician vs Spanish disambiguation', () => {
    test('Galician-specific words detected correctly', () => {
      expect(detectLanguage('Grazas pola axuda hoxe')).toBe('gl');
    });

    test('Spanish without Galician markers stays Spanish', () => {
      expect(detectLanguage('Gracias por la ayuda hoy')).toBe('es');
    });
  });
});
