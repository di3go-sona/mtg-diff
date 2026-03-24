import { CardQuantity, DiffResult, DeckDiff, Deck, CardGroup, GroupingMode, SortMode, SortDirection, CARD_TYPE_ORDER } from './card';
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

export function sortItems(
  items: CardQuantity[],
  mode: SortMode,
  direction: SortDirection
): CardQuantity[] {
  const sorted = [...items];

  switch (mode) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      if (direction === 'desc') sorted.reverse();
      break;
    case 'cmc':
      sorted.sort((a, b) => {
        const cmcA = scryfallClient.getCached(a.name)?.cmc ?? 999;
        const cmcB = scryfallClient.getCached(b.name)?.cmc ?? 999;
        return cmcA - cmcB;
      });
      if (direction === 'desc') sorted.reverse();
      break;
    case 'price':
      sorted.sort((a, b) => {
        const priceA = scryfallClient.getCached(a.name)?.price ?? -1;
        const priceB = scryfallClient.getCached(b.name)?.price ?? -1;
        if (priceA === -1 && priceB === -1) return a.name.localeCompare(b.name);
        if (priceA === -1) return 1;
        if (priceB === -1) return -1;
        return priceB - priceA;
      });
      if (direction === 'asc') sorted.reverse();
      break;
  }

  return sorted;
}

export function groupByCategory(items: CardQuantity[], sortMode: SortMode, sortDirection: SortDirection): CardGroup[] {
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
    .map((t) => ({ label: t, items: sortItems(groups[t], sortMode, sortDirection) }));
}

export function groupByCmc(items: CardQuantity[], sortMode: SortMode, sortDirection: SortDirection): CardGroup[] {
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
    items: sortItems(groups[k.toString()], sortMode, sortDirection),
  }));
}

export function groupItems(
  items: CardQuantity[],
  groupingMode: GroupingMode,
  sortMode: SortMode,
  sortDirection: SortDirection
): CardGroup[] {
  switch (groupingMode) {
    case 'category':
      return groupByCategory(items, sortMode, sortDirection);
    case 'cmc':
      return groupByCmc(items, sortMode, sortDirection);
    case 'none':
    default:
      return [{ label: '', items: sortItems(items, sortMode, sortDirection) }];
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
