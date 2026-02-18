const { detectBusinessLine, isBusinessHours } = require('../services/router');

describe('Router', () => {
  describe('detectBusinessLine', () => {
    test('detects boostic from SEO keywords', () => {
      expect(detectBusinessLine('Necesito mejorar el SEO de mi web')).toBe('boostic');
    });

    test('detects boostic from traffic keywords', () => {
      expect(detectBusinessLine('Quiero más tráfico orgánico y posicionamiento')).toBe('boostic');
    });

    test('detects binnacle from BI keywords', () => {
      expect(detectBusinessLine('Necesitamos un dashboard de business intelligence')).toBe('binnacle');
    });

    test('detects binnacle from data keywords', () => {
      expect(detectBusinessLine('Queremos montar un data warehouse con BigQuery')).toBe('binnacle');
    });

    test('detects marketing from SEM/ads keywords', () => {
      expect(detectBusinessLine('Queremos lanzar campañas de Google Ads y SEM')).toBe('marketing');
    });

    test('detects marketing from social media', () => {
      expect(detectBusinessLine('Necesitamos gestión de redes sociales y social media')).toBe('marketing');
    });

    test('detects tech from development keywords', () => {
      expect(detectBusinessLine('Necesitamos desarrollo de una app e-commerce')).toBe('tech');
    });

    test('detects tech from platform keywords', () => {
      expect(detectBusinessLine('Migrar nuestra tienda a Shopify o Magento')).toBe('tech');
    });

    test('returns null for generic message', () => {
      expect(detectBusinessLine('Hola, quiero información general')).toBe(null);
    });

    test('returns null for empty input', () => {
      expect(detectBusinessLine('')).toBe(null);
    });

    test('returns null for null input', () => {
      expect(detectBusinessLine(null)).toBe(null);
    });

    test('picks highest scoring line when multiple match', () => {
      // "api" matches tech, "analytics" matches boostic
      const result = detectBusinessLine('api cloud integración desarrollo web');
      expect(result).toBe('tech');
    });
  });

  describe('isBusinessHours', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.TIMEZONE = 'UTC';
      process.env.BUSINESS_HOURS_START = '9';
      process.env.BUSINESS_HOURS_END = '19';
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('returns a boolean', () => {
      expect(typeof isBusinessHours()).toBe('boolean');
    });

    test('uses configured timezone', () => {
      process.env.TIMEZONE = 'Europe/Madrid';
      // Just verify it doesn't throw
      expect(() => isBusinessHours()).not.toThrow();
    });

    test('uses default values when env not set', () => {
      delete process.env.TIMEZONE;
      delete process.env.BUSINESS_HOURS_START;
      delete process.env.BUSINESS_HOURS_END;
      expect(() => isBusinessHours()).not.toThrow();
    });
  });
});
