// node --experimental-strip-types .\epub_clean.ts
// npm run build
import fs from 'node:fs';
import path from 'node:path';
// import util from 'node:util';
import { EPub } from "epub2";
import AdmZip from 'adm-zip';
import extract from 'extract-zip';
import swearWords from './swear-words.json' with { type: 'json' };


// 1. Epub files are archived(zip) files separated by into 'Text', 'Styles', 'Images'...
// 2. To edit text, you can extract and map 'Text' directory files.
// 3. Archive(zip) back to epub.

(async () => {
  // scan for epub files.
  const epubDir = './epubs'; // original epub files.
  const buildDir = './build'; // cleaned epub files.
  const epubNames = fs.readdirSync(epubDir).filter((f) => f.endsWith('epub'));

  // build all epub files.
  for (const epubName of epubNames) {
    await cleanEpub(epubName);
  }

  // Each Epub is extracted, cleaned, archived.
  async function cleanEpub(epubName: string) {
    const epubPath = path.join(epubDir, epubName);
    const parsed = path.parse(epubPath);
    const epubBuildPath = path.join(process.cwd(), buildDir, parsed.name);

    // Get Epub directory structure
    const epub = await EPub.createAsync(epubPath, "./", "");
    const textPaths = epub.flow.map((meta) => path.join(epubBuildPath, meta?.href || ''));
    // console.log(textPaths);
    
    // ALWAYS create dir with file name.
    if (fs.existsSync(epubBuildPath)) fs.rmSync(epubBuildPath, { recursive: true, force: true }); // remove
    fs.mkdirSync(epubBuildPath, { recursive: true });
    
    // Extract Epub
    await extract(epubPath, { dir: epubBuildPath })
    console.log(`\n${parsed.name} was extracted.`);
    
    try {
      // Read Text Files and removeSwearWords.
      for (const textPath of textPaths) {
        const htm = removeSwearWords(fs.readFileSync(textPath, 'utf-8'));
        fs.writeFileSync(textPath, htm);
      }
      
      // Archive Epub
      const zip = new AdmZip();
      zip.addLocalFolder(epubBuildPath);
      zip.writeZip(path.join(epubBuildPath, `${parsed.name}-clean.epub`))
      console.log(`${parsed.name} was archived.\n\n`);
      
    } catch (error) {
      // error log and continue
      console.log(error);      
    }
  }

  function removeSwearWords(text: string) {
    const regex = new RegExp(`\\b(?:${swearWords.join('|')})\\b`, 'iug');
    return text.replaceAll(regex, '').replaceAll(/ {2,}/g, ' ').replaceAll(/brotherfucker/gi, 'brother lover');
  }
})();
