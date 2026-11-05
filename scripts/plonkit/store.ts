import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Guide, GuideIndexEntry } from '../../shared/plonkit.ts';
import { isSafeSlug } from './parse.ts';
import { isSafeImagePath, type GuideStore } from './sync.ts';

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

// Write to a temporary file and rename it, so an interrupted run never leaves a
// partial file that a later run mistakes for a complete guide or image.
async function writeFileAtomic(path: string, data: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, data);
  await rename(temporary, path);
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

  const guidePath = (slug: string) => {
    if (!isSafeSlug(slug)) throw new Error(`Unsafe guide slug: ${slug}`);
    return join(root, 'guides', `${slug}.json`);
  };

  return {
    readIndex: () => readJson<GuideIndexEntry[]>(join(root, 'index.json')),
    writeIndex: (index) => writeFileAtomic(join(root, 'index.json'), `${JSON.stringify(index, null, 2)}\n`),
    readGuide: async (slug) => readJson<Guide>(guidePath(slug)),
    writeGuide: async (guide) => writeFileAtomic(guidePath(guide.slug), `${JSON.stringify(guide, null, 2)}\n`),
    hasImage: (imageUrl) =>
      access(imagePath(imageUrl)).then(
        () => true,
        () => false,
      ),
    writeImage: (imageUrl, bytes) => writeFileAtomic(imagePath(imageUrl), bytes),
  };
}
