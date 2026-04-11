export interface ModelConfig {
  id: string;
  label: string;
  costPerMInput: number;
  costPerMOutput: number;
}

export const MODELS: ModelConfig[] = [
  {
    id: 'claude-haiku-4-20250514',
    label: 'Haiku 4',
    costPerMInput: 0.8,
    costPerMOutput: 4,
  },
  {
    id: 'claude-sonnet-4-20250514',
    label: 'Sonnet 4',
    costPerMInput: 3,
    costPerMOutput: 15,
  },
  {
    id: 'claude-opus-4-20250514',
    label: 'Opus 4',
    costPerMInput: 15,
    costPerMOutput: 75,
  },
];

export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export function getModelConfig(modelId: string): ModelConfig {
  return MODELS.find(m => m.id === modelId) ?? MODELS[1];
}
