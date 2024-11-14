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

export async function writeFile(meta, epub, buildPath) {
  // Get array of image metadata.
  // {
  //   id: 'item65',
  //   'media-type': 'image/jpeg',
  //   href: 'OEBPS/Images/image00374.jpeg',
  //   mediaType: 'image/jpeg',
  //   [Symbol(rawData)]: {
  //     id: 'item65',
  //     'media-type': 'image/jpeg',
  //     href: 'Images/image00374.jpeg'
  //   }
  // }

  // Image is only a separate function to add the 'pre-directory name'.
  // if (meta['media-type'].includes('image')) {
  //   const file = createPath(meta.href, true);
  //   const [buf, mimeType] = await epub.getImageAsync(meta.id);
  //   fs.writeFileSync(file, buf);
  //   return;
  // } else {
  const filePath = createPath(meta.href, buildPath);
  const [buf, mimeType] = await epub.getFileAsync(meta.id);
  fs.writeFileSync(filePath, buf);
  // }
}

export const sortBy = (key1, key2) => {
  return (a, b) =>
    a[key1] > b[key1]
      ? 1
      : a[key1] < b[key1]
      ? -1 // no match, must be equal.
      : a[key2] > b[key2]
      ? 1
      : a[key2] < b[key2]
      ? -1
      : 0;
};

export function unwantedChars(txt) {
  return txt
    .replaceAll(/[‘’]/g, "'")
    .replaceAll(/[“”]/g, '"')
    .replaceAll(/[\xa0\x00-\x09\x0b\x0c\x0e-\x1f\x7f]/g, ' ')
    .trim();
}

// replace non-ASCII chars
export function removeNonAscii(str, fileName = false) {
  // Using array.filter with ASCII values
  const txt = str
    .split('')
    .filter(function (char) {
      return char.charCodeAt(0) <= 127;
    })
    .join('');
  // if file name, remove illegal characters.
  return fileName ? txt.replaceAll(/[^-A-Za-z0-9_.]/g, '_').replaceAll(/_{2,}/g, '_') : txt;
}

// Puppeteer
// npm i puppeteer // chrome and core.
export async function generatePDF(htmlPath, pdfPath) {
  const puppeteer = await import('puppeteer');
  let browser;
  try {
    browser = await puppeteer.launch();
    const url = `file:${htmlPath}`;
    const page = await browser.newPage();
    await page.goto(url);
    // https://pptr.dev/api/puppeteer.pdfoptions
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '20px',
        left: '20px',
        right: '20px',
        bottom: '20px',
      },
    });
    console.log('PDF generated successfully');
  } catch (err) {
    console.error('Error generating PDF:', err);
  } finally {
    await browser.close();
  }
}
