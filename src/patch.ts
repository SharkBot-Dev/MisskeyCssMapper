import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';

import mapping from './mapping.json' with { type: "json" };

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

export function patchCss(path: string, filename: string) {
    const filePath = path;
    let content = fs.readFileSync(filePath, 'utf8');

    const regex = /\.([a-zA-Z0-9_-]+)\s*\{/g;
    const classNames = [...content.matchAll(regex)].map(match => match[1]);

    console.log(classNames)

    classNames.forEach((className) => {
        if (!className) return;

        try {
            content = content.replace(className, (mapping as Record<string, string>)[className] ?? className);
        } catch (e) {
            console.log(`パッチ失敗: ${e}`)
            return
        }
        
    })
        
    fs.writeFile("./patched_css/" + filename + '.css', content, 'utf8', (err) => {
        if (err) {
            console.error('保存に失敗しました:', err);
            return;
        }
        console.log(filename + "をパッチしました。");
    });
}