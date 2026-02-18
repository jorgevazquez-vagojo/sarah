const { detectLanguage } = require('../services/language-detector');

describe('Language Detector', () => {
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
