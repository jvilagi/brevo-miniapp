import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env['PLAYWRIGHT_MODULE_PATH'] ?? 'playwright');
const directory = fileURLToPath(new URL('../apps/web/public/icons/', import.meta.url));
const source = await readFile(`${directory}app-icon.svg`, 'utf8');
const browser = await chromium.launch({ ...(process.env['CHROME_EXECUTABLE'] ? { executablePath: process.env['CHROME_EXECUTABLE'] } : {}), headless: true });
try {
  const page = await browser.newPage();
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const data = await page.evaluate(async ({ svg, size }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(image, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { svg: source, size });
    await writeFile(`${directory}${name}`, Buffer.from(data, 'base64'));
  }
  console.log('Icones PNG generades a partir del SVG local.');
} finally { await browser.close(); }
