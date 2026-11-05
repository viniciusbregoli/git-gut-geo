import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Guide, GuideIndexEntry } from '../../shared/plonkit.ts';
import { isSafeImagePath, type GuideStore } from './sync.ts';

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function writeFileDeep(path: string, data: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

/**
 * Layout under `root` (data/plonkit by default):
 *   index.json, guides/<slug>.json, and images mirrored at their site paths.
 */
export function fileStore(root: string): GuideStore {
  const imagePath = (imageUrl: string) => {
    if (!isSafeImagePath(imageUrl)) throw new Error(`Unsafe image path: ${imageUrl}`);
    return join(root, imageUrl);
  };

  return {
    readIndex: () => readJson<GuideIndexEntry[]>(join(root, 'index.json')),
    writeIndex: (index) => writeFileDeep(join(root, 'index.json'), `${JSON.stringify(index, null, 2)}\n`),
    readGuide: (slug) => readJson<Guide>(join(root, 'guides', `${slug}.json`)),
    writeGuide: (guide) =>
      writeFileDeep(join(root, 'guides', `${guide.slug}.json`), `${JSON.stringify(guide, null, 2)}\n`),
    hasImage: (imageUrl) =>
      access(imagePath(imageUrl)).then(
        () => true,
        () => false,
      ),
    writeImage: (imageUrl, bytes) => writeFileDeep(imagePath(imageUrl), bytes),
  };
}
