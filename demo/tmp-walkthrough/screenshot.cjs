const { chromium } = require('playwright');
const { resolve } = require('path');

const htmlPath = resolve(__dirname, '..', 'walkthrough.html');
const outDir = __dirname;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  // Load the HTML file
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  // Wait for fonts to load
  await page.waitForTimeout(2000);

  // Get total number of slides
  const totalSlides = await page.evaluate(() => {
    return document.querySelectorAll('.slide').length;
  });
  console.log(`Total slides: ${totalSlides}`);

  for (let i = 0; i < totalSlides; i++) {
    // Navigate to slide by setting active class
    await page.evaluate((slideIndex) => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((s, idx) => {
        s.classList.remove('active', 'exit');
        if (idx === slideIndex) {
          s.classList.add('active');
          // Trigger animations
          s.querySelectorAll('.animate-in').forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          });
        }
      });
    }, i);

    // Wait for transition to settle
    await page.waitForTimeout(800);

    const num = String(i + 1).padStart(2, '0');
    const path = `${outDir}/slide-${num}.png`;
    await page.screenshot({ path, type: 'png' });
    console.log(`Screenshot: slide-${num}.png`);
  }

  await browser.close();
  console.log('Done taking screenshots.');
}

main().catch(console.error);
