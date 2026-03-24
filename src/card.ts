export type CardType =
  | 'Land'
  | 'Creature'
  | 'Instant'
  | 'Sorcery'
  | 'Enchantment'
  | 'Artifact'
  | 'Planeswalker'
  | 'Battle'
  | 'Other'
  | 'Unknown';

export interface CardData {
  name: string;
  manaCost: string;
  typeLine: string;
  cmc: number;
}

export interface CardIdentity {
  name: string;
}

export interface CardQuantity {
  name: string;
  count: number;
}

export interface Deck {
  main: Record<string, number>;
  side: Record<string, number>;
}

export interface DiffResult {
  cuts: CardQuantity[];
  adds: CardQuantity[];
  unchanged: CardQuantity[];
}

export interface DeckDiff {
  mainDiff: DiffResult;
  sideDiff: DiffResult;
}

export type GroupingMode = 'none' | 'category' | 'cmc';

export interface CardGroup {
  label: string;
  items: CardQuantity[];
}

export function getCardType(typeLine: string | undefined): CardType {
  if (typeLine === undefined) return 'Unknown';
  if (!typeLine) return 'Other';

  if (typeLine.includes('Land')) return 'Land';
  if (typeLine.includes('Creature')) return 'Creature';
  if (typeLine.includes('Planeswalker')) return 'Planeswalker';
  if (typeLine.includes('Instant')) return 'Instant';
  if (typeLine.includes('Sorcery')) return 'Sorcery';
  if (typeLine.includes('Enchantment')) return 'Enchantment';
  if (typeLine.includes('Artifact')) return 'Artifact';
  if (typeLine.includes('Battle')) return 'Battle';

  return 'Other';
}

export const CARD_TYPE_ORDER: CardType[] = [
  'Land',
  'Creature',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Planeswalker',
  'Battle',
  'Other',
  'Unknown',
];
