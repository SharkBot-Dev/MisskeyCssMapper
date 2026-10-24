import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { patchCss } from "./patch.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const inputDirectory = path.resolve(here, "../css");
const outputDirectory = path.resolve(here, "../patched_css");

try {
  const files = fs.readdirSync(inputDirectory).filter(file => path.extname(file) === ".css");
  for (const file of files) patchCss(path.join(inputDirectory, file), file, outputDirectory);
} catch (error) {
  console.error("CSS の処理に失敗しました:", error);
  process.exitCode = 1;
}
