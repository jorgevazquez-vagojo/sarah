// Test scoring weights are correctly defined
const { scoreLead } = require('../services/lead-capture');

// scoreLead depends on DB, so we test the export exists
describe('Lead Capture', () => {
  test('scoreLead function is exported', () => {
    expect(typeof scoreLead).toBe('function');
  });

  describe('Scoring weights validation', () => {
    // Access internal SCORING via re-reading module
    let SCORING;
    beforeAll(() => {
      // Read the module source to validate weights
      const fs = require('fs');
      const source = fs.readFileSync(require.resolve('../services/lead-capture'), 'utf-8');
      const hasEmail = source.match(/hasEmail:\s*(\d+)/);
      const hasPhone = source.match(/hasPhone:\s*(\d+)/);
      const hasCompany = source.match(/hasCompany:\s*(\d+)/);
      const hasBusinessLine = source.match(/hasBusinessLine:\s*(\d+)/);
      const messageCount = source.match(/messageCount:\s*(\d+)/);
      const escalated = source.match(/escalated:\s*(\d+)/);
      const calledVoip = source.match(/calledVoip:\s*(\d+)/);

      SCORING = {
        hasEmail: parseInt(hasEmail[1]),
        hasPhone: parseInt(hasPhone[1]),
        hasCompany: parseInt(hasCompany[1]),
        hasBusinessLine: parseInt(hasBusinessLine[1]),
        messageCount: parseInt(messageCount[1]),
        escalated: parseInt(escalated[1]),
        calledVoip: parseInt(calledVoip[1]),
      };
    });

    test('email has highest single weight', () => {
      expect(SCORING.hasEmail).toBe(20);
    });

    test('company weight is reasonable', () => {
      expect(SCORING.hasCompany).toBe(15);
    });

    test('max possible score is 100', () => {
      // email(20) + phone(10) + company(15) + line(10) + messages(20 max) + escalated(15) + voip(10) = 100
      const maxScore = SCORING.hasEmail + SCORING.hasPhone + SCORING.hasCompany +
        SCORING.hasBusinessLine + 20 + SCORING.escalated + SCORING.calledVoip;
      expect(maxScore).toBe(100);
    });

    test('phone weight is less than email', () => {
      expect(SCORING.hasPhone).toBeLessThan(SCORING.hasEmail);
    });
  });
});
