import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadConfig() {
  const url = pathToFileURL(path.resolve(__dirname, '..', 'src', 'plugin.config.ts')).href;
  const mod = await import(url);
  return mod.default;
}

function prepareFolder(distRoot: string, target: string) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  // Copy all JS files and plugin.yml (but avoid copying directories)
  const entries = fs.readdirSync(distRoot);
  const filesToCopy = entries.filter((e) => {
    const fullPath = path.join(distRoot, e);
    const isFile = fs.statSync(fullPath).isFile();
    // Copy all .js files and plugin.yml
    return isFile && (e.endsWith('.js') || e === 'plugin.yml');
  });
  for (const file of filesToCopy) {
    fs.copyFileSync(path.join(distRoot, file), path.join(target, file));
  }
  console.log(`Copied ${filesToCopy.length} files: ${filesToCopy.join(', ')}`);
}

async function main() {
  const cfg = await loadConfig();
  const identifier: string = cfg?.identifier;
  if (!identifier) {
    console.error('Missing identifier in plugin.config.ts');
    process.exit(1);
  }

  const distRoot = path.resolve(__dirname, '..', 'dist');
  const target = path.join(distRoot, identifier);

  // Clean target folder if exists
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }

  // Copy built files into dist/<identifier>
  prepareFolder(distRoot, target);

  console.log(`Prepared plugin folder at: ${target}`);
}

main();
