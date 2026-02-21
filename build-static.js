#!/usr/bin/env node
/**
 * Build static index.html from WordPress theme PHP templates
 * Replaces all PHP _re() / __r() calls with Spanish translations
 */
const fs = require('fs');
const path = require('path');

const THEME = path.join(__dirname, '..', 'NewRedegalWeb', 'wp-content', 'themes', 'redegal-v2');
const OUT = path.join(__dirname, 'server', 'public', 'index.html');

// Load Spanish translations
const esFile = fs.readFileSync(path.join(THEME, 'inc', 'lang', 'es.php'), 'utf8');
const translations = {};
const re = /^\s*'([^']+)'\s*=>\s*'((?:[^'\\]|\\.)*)'/gm;
let m;
while ((m = re.exec(esFile)) !== null) {
  translations[m[1]] = m[2].replace(/\\'/g, "'");
}

function t(key) {
  return translations[key] || `[${key}]`;
}

// Read PHP files
const header = fs.readFileSync(path.join(THEME, 'header.php'), 'utf8');
const frontPage = fs.readFileSync(path.join(THEME, 'front-page.php'), 'utf8');
const footer = fs.readFileSync(path.join(THEME, 'footer.php'), 'utf8');

// Concatenate: header <main> content </main> footer
let php = header + '\n' + frontPage + '\n' + footer;

// Remove PHP-only lines (get_header, get_footer, opening PHP tags)
php = php.replace(/^<\?php\s*\n/gm, '');
php = php.replace(/get_header\(\);\s*\?>\s*/g, '');
php = php.replace(/get_footer\(\);\s*\?>/g, '');
php = php.replace(/<\?php\s*\/\*\*[\s\S]*?\*\/\s*\?>\s*/g, ''); // comment blocks

// Replace _re('key') — echo translation
php = php.replace(/<\?php\s+_re\('([^']+)'\);\s*\?>/g, (_, key) => t(key));

// Replace <?php echo __r('key'); ?> — return translation
php = php.replace(/<\?php\s+echo\s+__r\('([^']+)'\);\s*\?>/g, (_, key) => t(key));

// Replace <?php _re('key'); ?> inside attributes (data-typing etc.)
php = php.replace(/<\?php\s+_re\('([^']+)'\);\s*\?>/g, (_, key) => t(key));

// Replace esc_url(home_url('/...')) with #
php = php.replace(/<\?php\s+echo\s+esc_url\(home_url\('([^']*)'\)\);\s*\?>/g, '#');

// Replace get_option calls
php = php.replace(/<\?php\s+echo\s+esc_html\(get_option\('redegal_stock_price',\s*'([^']*)'\)\);\s*\?>/g, '$1');
php = php.replace(/<\?php\s+echo\s+esc_html\(get_option\('redegal_stock_change',\s*'([^']*)'\)\);\s*\?>/g, '$1');

// Replace date('Y')
php = php.replace(/<\?php\s+echo\s+date\('Y'\);\s*\?>/g, '2026');

// Replace $lang checks
php = php.replace(/<\?php\s+echo\s+\$lang\s*===\s*'es'\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*;\s*\?>/g, '$1');

// Replace bloginfo
php = php.replace(/<\?php\s+bloginfo\('charset'\);\s*\?>/g, 'UTF-8');

// Remove wp_head, wp_footer, wp_body_open
php = php.replace(/<\?php\s+wp_head\(\);\s*\?>/g, '');
php = php.replace(/<\?php\s+wp_footer\(\);\s*\?>/g, '');
php = php.replace(/<\?php\s+wp_body_open\(\);\s*\?>/g, '');

// Remove conditional hreflang block
php = php.replace(/<\?php\s+if\s*\(\$lang\s*===\s*'en'\)[\s\S]*?<\?php\s+endif;\s*\?>/g, '');

// Replace $lang variable
php = php.replace(/<\?php\s+\$lang\s*=\s*redegal_get_lang\(\);\s*\?>\s*/g, '');

// Handle the logos PHP block — generate static HTML
const logosHtml = generateLogos();
php = php.replace(/<\?php\s*\n\s*\$logos\s*=\s*\[[\s\S]*?foreach\s*\(\$logos[\s\S]*?\?>\s*<\/div>\s*<\/div>/g,
  logosHtml + '\n    </div>\n  </div>');

// Handle industries PHP block
const industriesHtml = generateIndustries();
php = php.replace(/<\?php\s*\n\s*\$industries\s*=\s*\[[\s\S]*?endforeach;\s*\?>/g, industriesHtml);

// Handle why-grid PHP block
const whyHtml = generateWhyCards();
php = php.replace(/<\?php\s*\n\s*\$whys\s*=\s*\[[\s\S]*?endforeach;\s*\?>/g, whyHtml);

// Handle partners/awards PHP blocks
const partnersHtml = generatePartners();
php = php.replace(/<\?php\s*\n\s*\$partners\s*=\s*\[[\s\S]*?endforeach;\s*\?>/g, partnersHtml);

const awardsListHtml = generateAwardsList();
php = php.replace(/<\?php\s*\n\s*\$awards\s*=\s*\['ardan'[\s\S]*?endforeach;\s*\?>/g, awardsListHtml);

// Handle tech grid PHP block
const techHtml = generateTechGrid();
php = php.replace(/<\?php\s*\n\s*\$techs\s*=\s*\[[\s\S]*?endforeach;\s*\?>/g, techHtml);

// Handle testimonials PHP block
const testimonialsHtml = generateTestimonials();
php = php.replace(/<\?php\s*\n\s*\$testimonials\s*=\s*\[[\s\S]*?endforeach;\s*\?>/g, testimonialsHtml);

// Handle chatbot widget conditional — replace with real widget loader
php = php.replace(/<!-- Chatbot Widget -->[\s\S]*?<\?php\s+endif;\s*\?>/, '');
// Handle rdgphone widget conditional
php = php.replace(/<!-- RDGPhone Widget -->[\s\S]*?<\?php\s+endif;\s*\?>/, '');

// Handle social links
php = php.replace(/<\?php\s+redegal_social_links\(\);\s*\?>/g, generateSocialLinks());

// Handle newsletter form onsubmit PHP
php = php.replace(/onsubmit="event\.preventDefault\(\);this\.innerHTML='<p class=\\'newsletter-thanks\\'><\?php _re\('footer\.newsletter\.thanks'\);\s*\?><\/p>'\s*;"/g,
  `onsubmit="event.preventDefault();this.innerHTML='<p class=\\'newsletter-thanks\\'>${t('footer.newsletter.thanks')}</p>';"`);

// Remove any remaining PHP tags
php = php.replace(/<\?php[\s\S]*?\?>/g, '');

// Add Google Fonts to head
php = php.replace('</head>',
`  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/main.css">
  <title>Redegal &mdash; A Smart Digital Company | Consultora Full Digital</title>
</head>`);

// Add main.js and chatbot widget before </body>
php = php.replace('</body>',
`<!-- Real Chatbot Widget (Shadow DOM, connects to backend) -->
<script>
  window.RdgBot = {
    baseUrl: window.location.origin + '/widget',
    apiUrl: (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws/chat',
    configUrl: window.location.origin + '/api/config/widget',
    language: 'auto',
    primaryColor: '#007fff'
  };
</script>
<script>
(function(){
  var BASE = window.RdgBot && window.RdgBot.baseUrl ? window.RdgBot.baseUrl : '/widget';
  var host = document.createElement('div');
  host.id = 'rdgbot-host';
  host.style.cssText = 'position:fixed;z-index:2147483647;bottom:0;right:0;';
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = BASE + '/widget.css';
  shadow.appendChild(link);
  var mount = document.createElement('div');
  mount.id = 'rdgbot-root';
  shadow.appendChild(mount);
  var script = document.createElement('script');
  script.src = BASE + '/widget.js';
  script.onload = function(){
    if(typeof window.__rdgbotInit === 'function'){
      window.__rdgbotInit(mount, window.RdgBot || {});
    }
  };
  document.body.appendChild(script);
})();
</script>
<script src="/js/main.js"></script>
</body>`);

// Clean up multiple blank lines
php = php.replace(/\n{3,}/g, '\n\n');

fs.writeFileSync(OUT, php, 'utf8');
console.log(`Written ${OUT} (${php.length} bytes, ${php.split('\n').length} lines)`);

// === Generator functions ===

function generateLogos() {
  const logos = [
    ['Lacoste', 'serif', 20, 700, 3, 120],
    ['ABANCA', 'sans-serif', 18, 800, 2, 110],
    ['ADOLFO DOM\u00cdNGUEZ', 'serif', 15, 400, 4, 180],
    ['oney', 'sans-serif', 22, 700, 0, 80],
    ['McCain', 'sans-serif', 19, 700, 0, 100],
    ['ESTRELLA GALICIA', 'serif', 16, 700, 1, 160],
    ['SCALPERS', 'sans-serif', 18, 800, 2, 110],
    ['MANGO', 'sans-serif', 19, 400, 5, 100],
    ['Desigual', 'sans-serif', 18, 700, 1, 110],
    ['BIMBA Y LOLA', 'sans-serif', 16, 600, 2, 140],
    ['CALZEDONIA', 'serif', 17, 400, 3, 130],
    ['PARFOIS', 'sans-serif', 18, 300, 4, 100],
    ['PESCANOVA', 'sans-serif', 17, 700, 1, 120],
    ['UNDER ARMOUR', 'sans-serif', 16, 800, 2, 150],
    ['CUPRA', 'sans-serif', 19, 300, 5, 90],
    ['CHOPO', 'sans-serif', 20, 700, 1, 90],
    ['MILENIO', 'serif', 18, 700, 2, 110],
    ['BANCO AZTECA', 'sans-serif', 16, 600, 2, 140],
    ['ARMANI EXCHANGE', 'sans-serif', 15, 300, 4, 170],
    ['BANCA MARCH', 'serif', 17, 400, 2, 130],
    ['FAMILIA TORRES', 'serif', 16, 400, 2, 140],
    ['primor', 'sans-serif', 20, 700, 0, 90],
    ['GILMAR', 'sans-serif', 18, 300, 5, 100],
    ['GOCCO', 'sans-serif', 20, 700, 1, 90],
    ['euskaltel', 'sans-serif', 18, 600, 0, 110],
    ['COREN', 'sans-serif', 20, 700, 1, 80],
    ['MERLIN PROPERTIES', 'sans-serif', 15, 600, 3, 140],
    ['Mart\u00edn C\u00f3dax', 'serif', 17, 400, 0, 130],
  ];
  const items = logos.map(([text, ff, fs, fw, ls, w]) => {
    const style = (fw !== 400 ? ` font-weight="${fw}"` : '') + (ls ? ` letter-spacing="${ls}"` : '') + (text === 'McCain' ? ' font-style="italic"' : '') + (text === 'Martín Códax' ? ' font-style="italic"' : '');
    return `      <span class="logo-item" title="${text}"><svg viewBox="0 0 ${w} 28" fill="currentColor"><text x="0" y="21" font-family="${ff}" font-size="${fs}"${style}>${text}</text></svg></span>`;
  }).join('\n');
  return items + '\n' + items; // duplicate for marquee
}

function generateIndustries() {
  const industries = [
    ['fashion', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.38 3.46L16 2 12 5.5 8 2l-4.38 1.46a2 2 0 00-1.34 1.68l-.58 7A2 2 0 003.68 14H6l1.5 8h9L18 14h2.32a2 2 0 001.98-1.86l-.58-7a2 2 0 00-1.34-1.68z"/></svg>'],
    ['banking', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>'],
    ['fmcg', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>'],
    ['health', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'],
    ['auto', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>'],
    ['realestate', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'],
  ];
  return industries.map(([key, icon]) => `        <div class="industry-card reveal">
          <div class="industry-card-icon">${icon}</div>
          <h3>${t('industries.' + key)}</h3>
          <p>${t('industries.' + key + '.desc')}</p>
        </div>`).join('\n');
}

function generateWhyCards() {
  const whys = [
    ['tech', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'],
    ['data', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>'],
    ['global', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>'],
    ['public', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>'],
    ['partners', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>'],
    ['e2e', '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'],
  ];
  return whys.map(([key, icon]) => `        <div class="why-card reveal">
          <div class="why-card-icon">${icon}</div>
          <h3>${t('why.' + key + '.title')}</h3>
          <p>${t('why.' + key + '.desc')}</p>
        </div>`).join('\n');
}

function generatePartners() {
  const partners = [
    ['shopify', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>'],
    ['adobe', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'],
    ['google', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'],
    ['salesforce', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.5 19H9a7 7 0 110-14h.5"/><path d="M17.5 5A4.5 4.5 0 0122 9.5 4.5 4.5 0 0117.5 14H9"/></svg>'],
    ['meta', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>'],
    ['bigcommerce', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>'],
    ['connectif', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>'],
    ['bme', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'],
  ];
  return partners.map(([key, icon]) => `        <div class="award-item">
          <div class="award-icon">${icon}</div>
          <h4>${t('awards.' + key)}</h4>
          <p>${t('awards.' + key + '.desc')}</p>
        </div>`).join('\n');
}

function generateAwardsList() {
  const awards = ['ardan','pyme','eawards','googleroi','aje','covid','treenation','iab'];
  return awards.map(a => `        <div class="award-item">
          <h4>${t('awards.' + a)}</h4>
          <p>${t('awards.' + a + '.desc')}</p>
        </div>`).join('\n');
}

function generateTechGrid() {
  const techs = [
    ['Shopify Plus', 'tech.shopify.sub'],
    ['Adobe Commerce', 'tech.adobe.sub'],
    ['Google', 'tech.google.sub'],
    ['Salesforce', 'tech.salesforce.sub'],
    ['Meta', 'tech.meta.sub'],
    ['BigCommerce', 'tech.bigcommerce.sub'],
  ];
  return techs.map(([name, sub]) => `        <div class="tech-item">
          <div class="tech-item-name">${name}</div>
          <div class="tech-item-sub">${t(sub)}</div>
        </div>`).join('\n');
}

function generateTestimonials() {
  const testimonials = [
    ['1', 'JL', 'var(--gradient-brand)'],
    ['2', 'MR', 'linear-gradient(135deg,#f59e0b,#e17055)'],
    ['3', 'SC', 'linear-gradient(135deg,#818cf8,#6c5ce7)'],
  ];
  return testimonials.map(([key, initials, gradient]) => `          <div class="testimonial-card">
            <div class="testimonial-quote">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.15"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151C7.563 6.068 6 8.789 6 11h4v10H0z"/></svg>
            </div>
            <p class="testimonial-text">${t('testimonial' + key + '.text')}</p>
            <div class="testimonial-author">
              <div class="testimonial-avatar" style="background:${gradient};">${initials}</div>
              <div>
                <div class="testimonial-name">${t('testimonial' + key + '.name')}</div>
                <div class="testimonial-role">${t('testimonial' + key + '.role')}</div>
              </div>
            </div>
          </div>`).join('\n');
}

function generateSocialLinks() {
  return `<div class="social-links">
        <a href="https://www.linkedin.com/company/redegal" target="_blank" rel="noopener" aria-label="LinkedIn"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
        <a href="https://x.com/redegal" target="_blank" rel="noopener" aria-label="X/Twitter"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
        <a href="https://www.instagram.com/_redegal/" target="_blank" rel="noopener" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>
        <a href="https://www.facebook.com/Redegal" target="_blank" rel="noopener" aria-label="Facebook"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
        <a href="https://www.youtube.com/channel/UCDXwbtEULPIYV2I1ugDzeUw/videos" target="_blank" rel="noopener" aria-label="YouTube"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
        <a href="https://www.tiktok.com/@agenciaredegal" target="_blank" rel="noopener" aria-label="TikTok"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a>
      </div>`;
}
