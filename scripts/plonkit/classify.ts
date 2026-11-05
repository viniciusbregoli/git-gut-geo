import type { ClueType } from '../../shared/plonkit.ts';

const TAG_TO_TYPE: Record<string, ClueType> = {
  coverage: 'coverage',
  'license plates': 'plates',
  bollard: 'bollard',
  pole: 'pole',
  roadline: 'roadline',
  language: 'language',
  'chevron/sign': 'sign',
  guardrail: 'guardrail',
  vegetation: 'vegetation',
  landscape: 'landscape',
  architecture: 'architecture',
};

// Most tips carry no tag, so the text decides. Order matters: the first match
// wins, and the specific street-furniture clues come before the vaguer ones.
const KEYWORDS: [ClueType, RegExp][] = [
  ['plates', /\blicen[cs]e plates?\b|\bplates?\b/],
  ['bollard', /\bbollards?\b/],
  ['pole', /\b(utility |electricity |power |telephone )?poles?\b/],
  ['guardrail', /\bguard ?rails?\b/],
  ['roadline', /\broad ?lines?\b|\b(centre|center|side|edge|outer) lines?\b|\broad markings?\b/],
  ['coverage', /\bgoogle car\b|\bcamera\b|\bgen(eration)? ?\d\b|\bcoverage\b|\bsnorkel\b|\bantenna\b|\broof rack\b/],
  [
    'language',
    /\blanguages?\b|\balphabet\b|\bscript\b|\bletters?\b|\bdiacritics?\b|\bspelling\b|\bword for\b|\barea codes?\b|\bphone numbers?\b/,
  ],
  ['sign', /\bsigns?\b|\bchevrons?\b|\bsignage\b|\b(kilometre|kilometer|distance) markers?\b|\bwaystones?\b/],
  [
    'vegetation',
    /\bvegetation\b|\btrees?\b|\bpalms?\b|\bforests?\b|\bcrops?\b|\bfields?\b|\bsoil\b|\bvineyards?\b|\bplantations?\b|\borchards?\b|\bcitrus\b/,
  ],
  ['landscape', /\bmountains?\b|\bhills?\b|\blandscape\b|\bterrain\b|\bdesert\b/],
  ['architecture', /\bhouses?\b|\broofs?\b|\barchitecture\b|\bbuildings?\b|\bwindows?\b|\bdoors?\b|\bwalls?\b|\bchimneys?\b/],
];

export function classifyTip(tags: string[], text: string[]): ClueType {
  for (const tag of tags) {
    const type = TAG_TO_TYPE[tag];
    if (type) return type;
  }
  const haystack = text.join(' ').toLowerCase();
  for (const [type, pattern] of KEYWORDS) {
    if (pattern.test(haystack)) return type;
  }
  return 'other';
}

/** Clues you only see by driving around; useless for No Move and NMPZ. */
export function isMovingOnly(tags: string[]): boolean {
  return tags.includes('moving info');
}
