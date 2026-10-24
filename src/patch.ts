import fs from "node:fs";
import path from "node:path";

interface CssRule { selector: string; body: string; }

function readRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1]?.trim();
    const body = match[2]?.trim();
    if (selector && body && !selector.startsWith("@")) rules.push({ selector, body });
  }
  return rules;
}

function findSwitchClassMap(rules: CssRule[]): Record<string, string> {
  const declarations = new Map<string, string[]>();
  for (const { selector, body } of rules) {
    for (const match of selector.matchAll(/\.([_a-zA-Z][\w-]*)/g)) {
      const entries = declarations.get(match[1]!) ?? [];
      entries.push(body);
      declarations.set(match[1]!, entries);
    }
  }
  const joined = (name: string) => (declarations.get(name) ?? []).join(" ").toLowerCase();
  const has = (name: string, ...needles: string[]) => needles.every(needle => joined(name).includes(needle));
  const map: Record<string, string> = {};
  const classes = [...declarations.keys()];
  const track = classes.find(name => has(name, "--mi_theme-switchoffbg", "--height", "border-radius: 999px", "display: inline-flex"));
  if (!track) return map;
  map[track] = "switchBox";
  for (const name of classes) {
    if (name !== track && has(name, "--mi_theme-switchonbg", "border-color: var(--mi_theme-switchonbg)")) map[name] = "switchBoxOn";
  }
  const knob = classes.find(name => name !== track && has(name, "width: calc(var(--height) - 6px)", "height: calc(var(--height) - 6px)", "position: absolute", "border-radius: 999px"));
  if (knob) {
    map[knob] = "switchKnob";
    for (const name of classes) {
      if (name !== knob && has(name, "left: calc(100% - var(--height) + 3px)", "--mi_theme-switchonfg")) map[name] = "switchKnobOn";
    }
  }
  const label = classes.find(name => name !== track && name !== knob && has(name, "user-select: none", "transition: all .2s", "display: flex", "position: relative"));
  if (label) map[label] = "switchLabel";
  return map;
}

function words(value: string): string {
  return value.replace(/var\(--[^)]*\)/g, "Theme").replace(/[^a-zA-Z0-9]+(.)?/g, (_m, next: string | undefined) => next ? next.toUpperCase() : "").replace(/^[0-9]+/, "");
}

function descriptiveClassNames(rules: CssRule[], known: Record<string, string>): Record<string, string> {
  const classRules = new Map<string, string[]>();
  for (const { selector, body } of rules) {
    for (const match of selector.matchAll(/\.([_a-zA-Z][\w-]*)/g)) {
      const entries = classRules.get(match[1]!) ?? [];
      entries.push(body);
      classRules.set(match[1]!, entries);
    }
  }
  const used = new Set([...classRules.keys(), ...Object.values(known)]);
  const result = { ...known };
  for (const [className, bodies] of classRules) {
    if (result[className]) continue;
    const props = new Map<string, string>();
    for (const body of bodies) {
      for (const declaration of body.split(";")) {
        const sep = declaration.indexOf(":");
        if (sep < 0) continue;
        const property = declaration.slice(0, sep).trim().toLowerCase();
        const value = declaration.slice(sep + 1).trim().toLowerCase().replace(/!important/g, "");
        if (!property || property.startsWith("--") || property.startsWith("-") || !value) continue;
        if (!props.has(property)) props.set(property, value);
      }
    }
    // Use a small stable sample of properties so aliases remain readable and
    // do not depend on the obfuscated class token itself.
    const preferred = ["position", "display", "flex-direction", "align-items", "justify-content", "width", "height", "overflow", "text-align", "font-size", "border-radius", "cursor", "opacity", "transform", "padding", "margin"];
    const selected = preferred.filter(property => props.has(property)).slice(0, 3);
    if (selected.length === 0) selected.push(...[...props.keys()].slice(0, 2));
    let base = `mk${selected.map(property => `${words(property)}${words(props.get(property)!)}`).join("")}`;
    if (base === "mk") base = "mkStyledElement";
    base = base.slice(0, 72);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) candidate = `${base}${suffix++}`;
    used.add(candidate);
    result[className] = candidate;
  }
  return result;
}

function replaceSelectorClasses(css: string, map: Record<string, string>): string {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selector: string, body: string) => {
    if (selector.trimStart().startsWith("@")) return whole;
    const updated = selector.replace(/\.([_a-zA-Z][\w-]*)/g, (token, name: string) => map[name] ? `.${map[name]}` : token);
    return `${updated}{${body}}`;
  });
}

export function patchCss(filePath: string, filename: string, outputDirectory: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf8");
  const rules = readRules(content);
  const mapping = descriptiveClassNames(rules, findSwitchClassMap(rules));
  const patched = replaceSelectorClasses(content, mapping);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, `${filename}.css`), patched, "utf8");
  fs.writeFileSync(path.join(outputDirectory, `${filename}.mapping.json`), `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
  console.log(`${filename}: ${Object.keys(mapping).length} 個のクラス名を自動生成しました。`);
  return mapping;
}
