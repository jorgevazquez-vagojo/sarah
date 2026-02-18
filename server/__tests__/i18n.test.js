const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const LANG_DIR = path.join(__dirname, '..', 'config', 'languages');

describe('i18n', () => {
  const languages = fs.readdirSync(LANG_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => path.basename(f, '.yaml'));

  test('has 13 language files', () => {
    expect(languages).toHaveLength(13);
  });

  test('expected languages are present', () => {
    const expected = ['es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'zh', 'ja', 'ko', 'ar', 'gl', 'es-MX'];
    for (const lang of expected) {
      expect(languages).toContain(lang);
    }
  });

  describe('all language files', () => {
    const allStrings = {};

    beforeAll(() => {
      for (const lang of languages) {
        const content = fs.readFileSync(path.join(LANG_DIR, `${lang}.yaml`), 'utf8');
        allStrings[lang] = yaml.load(content);
      }
    });

    test('all files are valid YAML', () => {
      for (const lang of languages) {
        expect(allStrings[lang]).toBeTruthy();
        expect(typeof allStrings[lang]).toBe('object');
      }
    });

    test('all files have the same number of keys', () => {
      const counts = languages.map((l) => Object.keys(allStrings[l]).length);
      const uniqueCounts = [...new Set(counts)];
      expect(uniqueCounts).toHaveLength(1);
    });

    test('all files have the same keys', () => {
      const esKeys = Object.keys(allStrings['es']).sort();
      for (const lang of languages) {
        const keys = Object.keys(allStrings[lang]).sort();
        expect(keys).toEqual(esKeys);
      }
    });

    test('all values are non-empty strings', () => {
      for (const lang of languages) {
        for (const [key, value] of Object.entries(allStrings[lang])) {
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      }
    });

    test('essential keys are present', () => {
      const essentialKeys = ['greeting', 'placeholder', 'send', 'escalate', 'powered_by'];
      for (const lang of languages) {
        for (const key of essentialKeys) {
          expect(allStrings[lang]).toHaveProperty(key);
        }
      }
    });

    test('template variables are preserved', () => {
      for (const lang of languages) {
        if (allStrings[lang].lead_thanks) {
          expect(allStrings[lang].lead_thanks).toContain('{{name}}');
        }
      }
    });
  });
});
