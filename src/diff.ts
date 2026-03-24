import { CardQuantity, DiffResult, DeckDiff, Deck, CardGroup, GroupingMode, CARD_TYPE_ORDER } from './card';
import { scryfallClient } from './scryfall';

export function getDiff(source: Record<string, number>, target: Record<string, number>): DiffResult {
  const cuts: CardQuantity[] = [];
  const adds: CardQuantity[] = [];
  const unchanged: CardQuantity[] = [];

  for (const [card, qty] of Object.entries(source)) {
    const targetQty = target[card] || 0;
    if (qty > targetQty) {
      cuts.push({ name: card, count: qty - targetQty });
    }
  }

  for (const [card, qty] of Object.entries(target)) {
    const sourceQty = source[card] || 0;
    if (qty > sourceQty) {
      adds.push({ name: card, count: qty - sourceQty });
    } else if (qty === sourceQty && qty > 0) {
      unchanged.push({ name: card, count: qty });
    }
  }

  return { cuts, adds, unchanged };
}

export function calculateDeckDiff(sourceDeck: Deck, targetDeck: Deck): DeckDiff {
  return {
    mainDiff: getDiff(sourceDeck.main, targetDeck.main),
    sideDiff: getDiff(sourceDeck.side, targetDeck.side),
  };
}

export function sortByName(items: CardQuantity[]): CardQuantity[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export function groupByCategory(items: CardQuantity[]): CardGroup[] {
  const groups: Record<string, CardQuantity[]> = {};

  for (const item of items) {
    const type = scryfallClient.getCardType(item.name);
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(item);
  }

  return CARD_TYPE_ORDER
    .filter((t) => groups[t])
    .map((t) => ({ label: t, items: sortByName(groups[t]) }));
}

export function groupByCmc(items: CardQuantity[]): CardGroup[] {
  const groups: Record<string, CardQuantity[]> = {};

  for (const item of items) {
    const cached = scryfallClient.getCached(item.name);
    const cmc = cached ? Math.round(cached.cmc) : 0;
    const key = cmc.toString();

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }

  const sortedKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
  return sortedKeys.map((k) => ({
    label: k.toString(),
    items: sortByName(groups[k.toString()]),
  }));
}

export function groupItems(items: CardQuantity[], mode: GroupingMode): CardGroup[] {
  switch (mode) {
    case 'category':
      return groupByCategory(items);
    case 'cmc':
      return groupByCmc(items);
    case 'none':
    default:
      return [{ label: '', items: sortByName(items) }];
  }
}

export function getAllCardNames(diff: DeckDiff): string[] {
  const names = new Set<string>();

  for (const section of [diff.mainDiff, diff.sideDiff]) {
    for (const item of [...section.cuts, ...section.adds, ...section.unchanged]) {
      names.add(item.name);
    }
  }

  return Array.from(names);
}

export function getAddedCards(diff: DeckDiff): CardQuantity[] {
  return [...diff.mainDiff.adds, ...diff.sideDiff.adds];
}

export function getRemovedCards(diff: DeckDiff): CardQuantity[] {
  return [...diff.mainDiff.cuts, ...diff.sideDiff.cuts];
}
