import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadConfig() {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'src', 'plugin.config.ts')).href;
  const mod = await import(url);
  return mod.default;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src: string, dest: string) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

async function main() {
  const cfg = await loadConfig();
  const identifier: string = cfg?.identifier;
  if (!identifier) {
    console.error('Missing identifier in plugin.config.ts');
    process.exit(1);
  }

  const distRoot = path.resolve(__dirname, '..', 'dist');
  const builtFolder = path.join(distRoot, identifier);
  if (!fs.existsSync(builtFolder)) {
    console.error(`Built plugin folder not found: ${builtFolder}. Run pnpm build first.`);
    process.exit(1);
  }

  // Target Cider config path (Genten as requested)
  const home = os.homedir();
  const ciderPluginsDir = path.join(home, '.config', 'sh.cider.genten', 'plugins');
  const target = path.join(ciderPluginsDir, identifier);

  ensureDir(ciderPluginsDir);
  // Clean target
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  copyDir(builtFolder, target);
  console.log(`Deployed to: ${target}`);
}

main();
