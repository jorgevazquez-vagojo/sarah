jest.mock('../utils/db', () => ({
  db: {
    getConversation: jest.fn().mockResolvedValue({
      id: 'conv-1',
      visitor_id: 'v1',
      language: 'es',
      business_line: 'boostic',
      started_at: '2024-01-15T10:00:00Z',
      closed_at: '2024-01-15T10:30:00Z',
    }),
    getMessages: jest.fn().mockResolvedValue([
      { sender: 'bot', content: 'Hola! Bienvenido.', created_at: '2024-01-15T10:00:00Z', metadata: {} },
      { sender: 'visitor', content: 'Quiero info sobre SEO', created_at: '2024-01-15T10:01:00Z', metadata: {} },
      { sender: 'bot', content: 'Perfecto, te cuento.', created_at: '2024-01-15T10:01:30Z', metadata: {} },
      { sender: 'note', content: 'Internal note', created_at: '2024-01-15T10:02:00Z', metadata: { internal: true } },
      { sender: 'agent', content: 'Hola, soy Ana.', created_at: '2024-01-15T10:05:00Z', metadata: { agentName: 'Ana' } },
    ]),
    query: jest.fn().mockResolvedValue({ rows: [{ name: 'Maria', email: 'maria@test.com', company: 'TestCo' }] }),
  },
}));

const { generateTranscript } = require('../services/transcript-export');

describe('Transcript Export', () => {
  test('generates text transcript', async () => {
    const result = await generateTranscript('conv-1');
    expect(result.text).toContain('REDEGAL');
    expect(result.text).toContain('Visitante');
    expect(result.text).toContain('Quiero info sobre SEO');
    // Internal notes should be excluded
    expect(result.text).not.toContain('Internal note');
  });

  test('generates HTML transcript', async () => {
    const result = await generateTranscript('conv-1');
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('Redegal');
    expect(result.html).toContain('Quiero info sobre SEO');
    expect(result.html).not.toContain('Internal note');
  });

  test('includes metadata', async () => {
    const result = await generateTranscript('conv-1');
    expect(result.metadata.conversationId).toBe('conv-1');
    expect(result.metadata.language).toBe('es');
    expect(result.metadata.businessLine).toBe('boostic');
    expect(result.metadata.messageCount).toBe(5);
  });

  test('includes lead info in text', async () => {
    const result = await generateTranscript('conv-1');
    expect(result.text).toContain('Maria');
    expect(result.text).toContain('maria@test.com');
  });
});
