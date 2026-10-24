import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';

import { patchCss } from "./patch.js"

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const folderPath = path.join(__dirname, '../css');

try {
  const files = fs.readdirSync(folderPath);

  const cssFilesData = files
    .filter(file => path.extname(file) === '.css')
    .map(file => {
      patchCss(path.join(folderPath, file), file);
    });
} catch (err) {
  console.error('エラーが発生しました:', err);
}