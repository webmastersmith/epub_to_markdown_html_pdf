import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';
import turndownPluginGfm from 'turndown-plugin-gfm';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const swearWords = require('./swear-words.json');

const gfm = turndownPluginGfm.gfm;
const turndownService = new TurndownService({ linkStyle: 'referenced' });
turndownService.use(gfm);

export function createMarkdown(txt) {
  // html class names break turndown.
  // remove class names and remove leftover tag space.
  const html = txt.replaceAll(/class="[^"]*"/g, '').replaceAll(/(<\w+) >/g, '$1>');
  return turndownService.turndown(html);
}

export function removeSwearWords(text) {
  const pattern = swearWords.join('|');
  const regex = new RegExp(`\\b(?:${pattern})\\b`, 'ig'); // 'i' flag for case-insensitive matching
  return text.replaceAll(regex, '').replaceAll(/ {2,}/g, ' ');
}

function createPath(href, buildPath) {
  const folders = href.split(/\/|\\/);
  const file = folders.pop();
  const fileDir = path.join(buildPath, ...folders);
  if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });
  return path.join(fileDir, file);
}

export async function writeFile(meta, epub, buildPath, fontSize = 1) {
  const filePath = createPath(meta.href, buildPath);
  const [buf, mimeType] = await epub.getFileAsync(meta.id);
  // css fix font-size
  if (meta.href.endsWith('css')) {
    const fontSizeFix = buf.toString().replace(/font-size: ?([0-9.]+)(\w+)/g, (_, c1, c2) => {
      return `font-size: ${(parseFloat(c1) * 1000 * (fontSize * 1000)) / 1000000}${c2}`;
    });
    // console.log(fontSizeFix);
    fs.writeFileSync(filePath, fontSizeFix);
    return;
  }
  fs.writeFileSync(filePath, buf);
}

export function unwantedChars(txt) {
  return txt
    .replaceAll(/[‘’]/g, "'")
    .replaceAll(/[“”]/g, '"')
    .replaceAll(/—|⸺|―/g, '-')
    .replaceAll(/[\xa0\x00-\x09\x0b\x0c\x0e-\x1f\x7f]/g, ' ')
    .trim();
}

// replace non-ASCII chars
export function removeNonAscii(str, fileName = false, directory = false, link = false) {
  // Using array.filter with ASCII values
  const txt = str
    .split('')
    .filter(function (char) {
      return char.charCodeAt(0) <= 127;
    })
    .join('');
  // links
  if (link) return txt.replaceAll(/[^-A-Za-z0-9]/g, '-').replaceAll(/_{2,}/g, '_');
  // directory
  if (directory) return txt.replaceAll(/[^A-Za-z0-9_]/g, '_').replaceAll(/_{2,}/g, '_');
  // if file name, remove illegal characters.
  if (fileName) return txt.replaceAll(/[^-A-Za-z0-9_.]/g, '_').replaceAll(/_{2,}/g, '_');
  return txt;
}

// remove directories and special characters from links.
export function fixLink(href) {
  // sub links have hash tags
  if (href.includes('#')) return removeNonAscii(href.split('#').pop(), false, false, true);
  // sometimes start with digit. Fix with letter.
  return `C${removeNonAscii(href.split(/\/|\\/).pop(), false, false, true)}`;
}

// Puppeteer
// npm i puppeteer // chrome and core.
export async function generatePDF(htmlPath, pdfPath) {
  const puppeteer = await import('puppeteer');
  let browser;
  try {
    browser = await puppeteer.launch({
      // headless: false,
    });
    const url = `file:${htmlPath}`;
    const page = await browser.newPage();
    await page.goto(url);
    // https://pptr.dev/api/puppeteer.pdfoptions
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      // margin: {
      //   top: '20px',
      // left: '20px',
      // right: '20px',
      // bottom: '20px',
      // },
    });
    console.log(`${pdfPath.split(/\\|\//).pop()} PDF generated successfully`);
  } catch (err) {
    console.error('Error generating PDF:', err);
  } finally {
    await browser.close();
  }
}
