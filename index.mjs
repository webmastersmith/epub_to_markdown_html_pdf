import { EPub } from 'epub2';
import {
  writeFile,
  fixLink,
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
// reverse color scheme.
const darkMode = false;
// change font-size for mobile devices.
const fontSize = 1; // e.g. fontSize=1.5; // 1.5 times the normal size.

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

  let book = '';
  const epub = await EPub.createAsync(path.join(epubDir, file), './', '');
  // epub.flow // 'spine'. ordered reading content.
  // epub.manifest // all 'spine' content + media: images, css, font...

  // Get the xml metadata.
  const xml = epub.flow;
  for (const [i, meta] of xml.entries()) {
    try {
      // extract html
      const html = await epub.getChapterAsync(meta.id);
      // Fix links. Add id to each section for table of contents.
      const fixId = html.replace(/<(\w+).*>/, (_, c1) => {
        // if coverImage
        if (i === 0) return `<${c1} id="${fixLink(meta.href)} coverImage">`;
        return `<${c1} id="${fixLink(meta.href)}" type="bookSection">`;
      });
      // fix links in table of contents.
      if (/\bcontent/i.test(meta.title)) {
        book += fixId.replace(/href="([^"]*)"/g, (_, c1) => `href="#${fixLink(c1)}"`);
        continue;
      }
      book += fixId;
    } catch (error) {
      console.error('Error extracting content', meta);
    }
  }

  // extract the media
  const media = Object.values(epub.manifest).filter((meta) => !meta['media-type'].endsWith('xml'));
  // console.log(media);
  for (const meta of media) {
    writeFile(meta, epub, buildPath, fontSize);
  }

  // extract css file links.
  const cssLinks = [];
  for (const meta of media) {
    if (meta.href.endsWith('css')) cssLinks.push(`<link rel="stylesheet" href="${meta.href}">`);
  }

  const background = '#101010';
  const text = '#f5f5f5';
  const darkStyle = `
/* font-size increased for mobile devices. */
background-color: ${darkMode ? background : text} !important;
color: ${darkMode ? text : background} !important;
`;
  // final html build
  const cleanBook = clean ? removeSwearWords(unwantedChars(book)) : unwantedChars(book);
  const html = `
  <html lang="en">
    <head>
      ${cssLinks.join('\n')}
      <style>
        body {
          /* font-size increased for mobile devices. */
          font-size: ${fontSize}rem !important;
          padding: 20px !important;
          ${darkStyle}
        }
      </style>
    </head>
    <body>
      ${cleanBook}
    </body>
  </html>
  `;
  // Create html file
  fs.writeFileSync(htmlPath, html);

  // Create markdown
  const md = createMarkdown(cleanBook);
  // attach cover image to markdown file.
  const mdBook = `![cover image](${epub.listImage()[0].href})\n` + md;
  // create markdown file
  fs.writeFileSync(markdownPath, mdBook);

  // Puppeteer -create pdf.
  await generatePDF(htmlPath, pdfPath);
}
