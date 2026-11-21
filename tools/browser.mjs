import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
// Use the locally installed Chromium (no download).
export function chromePath() {
  const base = `${homedir()}/.cache/ms-playwright`;
  const dir = readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().pop();
  const sub = readdirSync(`${base}/${dir}`).find((d) => d.startsWith('chrome-linux'));
  return `${base}/${dir}/${sub}/chrome`;
}
export const launch = () => chromium.launch({ executablePath: chromePath() });
