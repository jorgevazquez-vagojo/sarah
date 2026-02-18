const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { logger } = require('./logger');

const LANG_DIR = path.join(__dirname, '..', 'config', 'languages');
const strings = {};

function loadLanguages() {
  const files = fs.readdirSync(LANG_DIR).filter((f) => f.endsWith('.yaml'));
  for (const file of files) {
    const lang = path.basename(file, '.yaml');
    strings[lang] = yaml.load(fs.readFileSync(path.join(LANG_DIR, file), 'utf8'));
    logger.info(`Loaded language: ${lang} (${Object.keys(strings[lang]).length} keys)`);
  }
}

function t(lang, key, vars = {}) {
  const str = strings[lang]?.[key] || strings['es']?.[key] || key;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

function getSupportedLanguages() {
  return Object.keys(strings);
}

module.exports = { loadLanguages, t, getSupportedLanguages };
