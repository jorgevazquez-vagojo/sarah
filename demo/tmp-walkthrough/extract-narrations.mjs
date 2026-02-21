import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const htmlPath = resolve(import.meta.dirname, '..', 'walkthrough.html');
const html = readFileSync(htmlPath, 'utf-8');

// Extract all data-narration attributes
const regex = /data-narration="([^"]+)"/g;
const narrations = [];
let match;

while ((match = regex.exec(html)) !== null) {
  narrations.push(match[1]);
}

console.log(`Found ${narrations.length} narrations`);

// Write each narration to a text file and a combined JSON
const output = [];
for (let i = 0; i < narrations.length; i++) {
  const num = String(i + 1).padStart(2, '0');
  const text = narrations[i]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec)));

  const txtPath = resolve(import.meta.dirname, `narration-${num}.txt`);
  writeFileSync(txtPath, text);
  output.push({ slide: i + 1, num, text });
  console.log(`Slide ${num}: ${text.substring(0, 60)}...`);
}

writeFileSync(resolve(import.meta.dirname, 'narrations.json'), JSON.stringify(output, null, 2));
console.log('All narrations extracted.');
