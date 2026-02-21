/**
 * Record the demo-video.html as a 1920x1080 webm video using Playwright.
 * Usage: NODE_PATH=../NewRedegalWeb/video/node_modules node record-demo.js
 */

const { chromium } = require('playwright');
const path = require('path');

const DEMO_HTML = path.join(__dirname, 'demo-video.html');
const OUTPUT_DIR = process.env.HOME + '/Downloads';
const DURATION_MS = 15 * 60 * 1000 + 10_000; // 15 min + 10s buffer

(async () => {
  console.log('Launching browser...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1920, height: 1080 },
    },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });

  const page = await context.newPage();
  console.log('Loading demo...');

  await page.goto(`file://${DEMO_HTML}`, { waitUntil: 'load' });
  console.log(`Recording for ${DURATION_MS / 1000}s... Output: ${OUTPUT_DIR}/`);

  // Wait for the full demo duration
  await page.waitForTimeout(DURATION_MS);

  console.log('Stopping recording...');
  await page.close();
  await context.close();

  // Get the video file path
  const video = page.video();
  if (video) {
    const videoPath = await video.path();
    const finalPath = path.join(OUTPUT_DIR, 'RDGBot-Demo-15min.webm');

    // Rename to final name
    const fs = require('fs');
    if (fs.existsSync(videoPath)) {
      fs.renameSync(videoPath, finalPath);
      console.log(`Video saved: ${finalPath}`);
    } else {
      console.log(`Video file at: ${videoPath}`);
    }
  }

  await browser.close();
  console.log('Done!');
})();
