import { Deck } from './card';

const CARD_LINE_REGEX = /^(\d+)\s+(.+?)(?:\s+\(|$)/;
const SIDEBOARD_MARKER = 'SIDEBOARD:';

export function parseDeck(text: string): Deck {
  const main: Record<string, number> = {};
  const side: Record<string, number> = {};
  let isSideboard = false;

  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toUpperCase().startsWith(SIDEBOARD_MARKER)) {
      isSideboard = true;
      continue;
    }

    const match = line.match(CARD_LINE_REGEX);
    if (match) {
      const qty = parseInt(match[1], 10);
      const name = match[2].trim();
      const target = isSideboard ? side : main;
      target[name] = (target[name] || 0) + qty;
    }
  }

  return { main, side };
}

export function extractCardNames(text: string): string[] {
  const names: string[] = [];
  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.toUpperCase().startsWith(SIDEBOARD_MARKER)) continue;

    const match = line.match(CARD_LINE_REGEX);
    if (match) {
      names.push(match[2].trim());
    }
  }

  return names;
}

export function formatDeckLine(quantity: number, name: string, set?: string): string {
  if (set) {
    return `${quantity} ${name} (${set})`;
  }
  return `${quantity} ${name}`;
}
