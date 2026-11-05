import type { ClueType } from '../../../shared/plonkit.ts';

const PROMPTS: Record<ClueType, string> = {
  coverage: 'Which country is this coverage from?',
  plates: 'Which country uses these plates?',
  bollard: 'Which country uses this bollard?',
  pole: 'Which country has these poles?',
  language: 'Which country writes like this?',
  roadline: 'Which country paints its roads like this?',
  sign: 'Which country uses this sign?',
  guardrail: 'Which country uses this guardrail?',
  vegetation: 'Where does this vegetation give it away?',
  landscape: 'Which country looks like this?',
  architecture: 'Which country builds like this?',
  other: 'Which country is this?',
};

export const promptFor = (type: ClueType) => PROMPTS[type];

const LABELS: Record<ClueType, string> = {
  coverage: 'Google car',
  plates: 'Plates',
  bollard: 'Bollards',
  pole: 'Poles',
  language: 'Language',
  roadline: 'Road lines',
  sign: 'Signs',
  guardrail: 'Guardrails',
  vegetation: 'Vegetation',
  landscape: 'Landscape',
  architecture: 'Architecture',
  other: 'Other',
};

export const clueLabel = (type: ClueType) => LABELS[type];
