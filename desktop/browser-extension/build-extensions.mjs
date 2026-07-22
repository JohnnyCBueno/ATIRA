import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(sourceDirectory, '..', '..');
const outputDirectory = path.join(projectDirectory, 'out', 'browser-extensions');
const sharedFiles = ['popup.css', 'popup.html', 'popup.js', 'service-worker.js', 'README.md'];

await build('chromium', 'manifest.json');
await build('firefox', 'manifest.firefox.json');

async function build(target, manifest) {
  const targetDirectory = path.join(outputDirectory, `atira-browser-activity-${target}`);
  await mkdir(targetDirectory, { recursive: true });
  await Promise.all(sharedFiles.map((file) => copyFile(path.join(sourceDirectory, file), path.join(targetDirectory, file))));
  await copyFile(path.join(sourceDirectory, manifest), path.join(targetDirectory, 'manifest.json'));
  console.log(`[ATIRA] Browser Activity ${target} build: ${targetDirectory}`);
}
