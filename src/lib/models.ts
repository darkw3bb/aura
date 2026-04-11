export interface ModelConfig {
  id: string;
  label: string;
  costPerMInput: number;
  costPerMOutput: number;
}

export const MODELS: ModelConfig[] = [
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    costPerMInput: 1,
    costPerMOutput: 5,
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6',
    costPerMInput: 3,
    costPerMOutput: 15,
  },
  {
    id: 'claude-opus-4-6',
    label: 'Opus 4.6',
    costPerMInput: 5,
    costPerMOutput: 25,
  },
];

export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export function getModelConfig(modelId: string): ModelConfig {
  return MODELS.find(m => m.id === modelId) ?? MODELS[1];
}
