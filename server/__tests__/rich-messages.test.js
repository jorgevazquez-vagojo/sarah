const { card, carousel, quickReplies, form, image, file, buttons } = require('../services/rich-messages');

describe('Rich Messages', () => {
  describe('card', () => {
    test('creates a basic card', () => {
      const result = card({ title: 'Test', subtitle: 'Sub' });
      expect(result.type).toBe('card');
      expect(result.title).toBe('Test');
      expect(result.subtitle).toBe('Sub');
      expect(result.buttons).toEqual([]);
    });

    test('creates card with buttons', () => {
      const result = card({
        title: 'Test',
        subtitle: 'Sub',
        imageUrl: 'https://example.com/img.jpg',
        buttons: ['Click me', { label: 'Visit', action: 'url', value: 'https://example.com' }],
      });
      expect(result.buttons).toHaveLength(2);
      expect(result.buttons[0]).toEqual({ label: 'Click me', action: 'postback', value: 'Click me' });
      expect(result.buttons[1]).toEqual({ label: 'Visit', action: 'url', value: 'https://example.com' });
      expect(result.imageUrl).toBe('https://example.com/img.jpg');
    });
  });

  describe('carousel', () => {
    test('creates carousel with multiple cards', () => {
      const result = carousel([
        { title: 'Card 1', subtitle: 'Sub 1' },
        { title: 'Card 2', subtitle: 'Sub 2' },
      ]);
      expect(result.type).toBe('carousel');
      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].type).toBe('card');
      expect(result.cards[1].title).toBe('Card 2');
    });
  });

  describe('quickReplies', () => {
    test('creates quick replies from strings', () => {
      const result = quickReplies('Choose one:', ['Yes', 'No', 'Maybe']);
      expect(result.type).toBe('quick_replies');
      expect(result.text).toBe('Choose one:');
      expect(result.replies).toEqual([
        { label: 'Yes', value: 'Yes' },
        { label: 'No', value: 'No' },
        { label: 'Maybe', value: 'Maybe' },
      ]);
    });

    test('creates quick replies from objects', () => {
      const result = quickReplies('Pick:', [{ label: 'A', value: '1' }]);
      expect(result.replies[0]).toEqual({ label: 'A', value: '1' });
    });
  });

  describe('form', () => {
    test('creates form with default submit label', () => {
      const result = form({ title: 'Contact', fields: ['name', 'email'] });
      expect(result.type).toBe('form');
      expect(result.title).toBe('Contact');
      expect(result.submitLabel).toBe('Submit');
    });

    test('creates form with custom submit label', () => {
      const result = form({ title: 'Contact', fields: [], submitLabel: 'Enviar' });
      expect(result.submitLabel).toBe('Enviar');
    });
  });

  describe('image', () => {
    test('creates image message', () => {
      const result = image({ url: 'https://example.com/pic.jpg', caption: 'Photo' });
      expect(result.type).toBe('image');
      expect(result.url).toBe('https://example.com/pic.jpg');
      expect(result.caption).toBe('Photo');
    });
  });

  describe('file', () => {
    test('creates file message', () => {
      const result = file({ url: '/uploads/doc.pdf', name: 'document.pdf', mimeType: 'application/pdf', size: 1024 });
      expect(result.type).toBe('file');
      expect(result.name).toBe('document.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.size).toBe(1024);
    });
  });

  describe('buttons', () => {
    test('creates button group', () => {
      const result = buttons('What next?', [
        'Option A',
        { label: 'Call', action: 'call', value: '+34900000' },
        { label: 'Escalate', action: 'escalate' },
      ]);
      expect(result.type).toBe('buttons');
      expect(result.text).toBe('What next?');
      expect(result.buttons).toHaveLength(3);
      expect(result.buttons[0].action).toBe('postback');
      expect(result.buttons[1].action).toBe('call');
      expect(result.buttons[2].action).toBe('escalate');
      expect(result.buttons[2].value).toBe('Escalate'); // falls back to label
    });
  });
});
