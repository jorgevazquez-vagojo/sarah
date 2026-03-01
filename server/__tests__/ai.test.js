const { callAI } = require('../services/ai');

describe('AI Service', () => {
  describe('callAI', () => {
    it('should call Claude successfully', async () => {
      // Mock test - expand with real tests
      const result = await callAI('Hello', {}, { provider: 'claude' });
      expect(result).toBeDefined();
    });
  });
});
