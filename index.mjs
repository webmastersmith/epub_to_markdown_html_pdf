import { EPub } from 'epub2';
import {
  writeFile,
  sortBy,
  createMarkdown,
  removeSwearWords,
  generatePDF,
  unwantedChars,
  removeNonAscii,
} from './utils.mjs';
import fs from 'fs';
import path from 'path';

// Epub to html, pdf and markdown. PDF keeps the images. Easier to use than markdown.
// html and pdf file can be dragged to browser window to view.
// https://www.npmjs.com/package/epub2
// https://github.com/bluelovers/ws-epub/blob/d27ef52af34a27b1f18b4fc3a101850638c7bb38/packages/epub2/index.ts
// https://github.com/bluelovers/ws-epub/blob/d27ef52af34a27b1f18b4fc3a101850638c7bb38/packages/epub2/test/example/example2.ts
// https://github.com/bluelovers/ws-epub/blob/HEAD/packages/epub2/test/example/example.ts

// remove swear words? change to false to keep them.
const clean = true;

// remove old build.
const buildDir = path.join(process.cwd(), 'build');
if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true });

// scan for epub files.
const epubDir = './epubs';
const files = fs.readdirSync(epubDir).filter((f) => f.endsWith('epub'));

// build all epub files.
for (const file of files) {
  await makePdf(file);
}

async function makePdf(file) {
  const epubName = removeNonAscii(file, true);
  const lastIndex = epubName.lastIndexOf('.');
  const name = epubName.slice(0, lastIndex);
  const buildPath = path.join(buildDir, name);
  const htmlPath = path.join(buildPath, `${name}.html`);
  const markdownPath = path.join(buildPath, `${name}.md`);
  const pdfPath = path.join(buildPath, `${name}.pdf`);

  // create the html
  let book = '';
  const epub = await EPub.createAsync(path.join(epubDir, file), './', '');

  let title;
  let nextRead;
  const xml = []; // html data.
  const media = []; // images, css files
  const data = Object.values(epub.manifest);
  for (const meta of data) {
    if (meta['media-type'].includes('xml')) {
      if (meta.id.includes('title')) {
        title = await epub.getChapterAsync(meta.id);
        continue;
      }
      if (meta.id.includes('next-read')) {
        nextRead = await epub.getChapterAsync(meta.id);
        continue;
      }
      // avoid table of contents. special file that can be downloaded.
      if (meta.id.includes('ncx')) {
        // toc = await epub.getChapterAsync(meta.id);
        continue;
      }
      xml.push(meta);
    } else media.push(meta);
  }
  // print media
  for (const meta of media) {
    writeFile(meta, epub, buildPath);
  }

  // sort xml
  const sortFn = sortBy('order', 'level');
  xml.sort(sortFn);
  for (const meta of xml) {
    book += await epub.getChapterAsync(meta.id);
  }

  const cssBlock = [];
  for (const meta of data) {
    if (meta.href.endsWith('css')) cssBlock.push(`<link rel="stylesheet" href="${meta.href}">`);
  }

  // final
  const cleanBook = clean ? removeSwearWords(unwantedChars(book)) : unwantedChars(book);
  const html = `
<html lang="en">
  <head>
    ${cssBlock.join('\n')}
  </head>
  <body style="font-size:2rem;">
    <img alt="Title Image" src="${epub.listImage()[0].href}" width="100%" height="100%">
    ${cleanBook}
    ${nextRead}
  </body>
</html>
`;
  // Create html file
  fs.writeFileSync(htmlPath, html);

  // Create markdown
  const md = createMarkdown(cleanBook + nextRead);
  // attach cover image to markdown file.
  const mdBook = `![cover image](${epub.listImage()[0].href})\n` + md;
  // create markdown file
  fs.writeFileSync(markdownPath, mdBook);

  // Puppeteer -create pdf.
  await generatePDF(htmlPath, pdfPath);
}
