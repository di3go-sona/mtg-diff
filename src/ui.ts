import { CardQuantity, CardGroup, DeckDiff, GroupingMode } from './card';
import { scryfallClient } from './scryfall';
import { groupItems, getAllCardNames } from './diff';
import { saveDeckContent } from './storage';

const SCRYFALL_SYMBOLS_BASE = 'https://svgs.scryfall.io/card-symbols';

type CardType = 'add' | 'remove' | 'unchanged';

let pendingFetchNames = new Set<string>();
let fetchDebounceTimer: number | null = null;
const FETCH_DEBOUNCE_MS = 500;

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function getManaHtml(manaCost: string): string {
  if (!manaCost) return '';

  return manaCost.replace(/{([^}]+)}/g, (_, symbol: string) => {
    let cleanSymbol = symbol.replace('/', '-').toUpperCase();
    cleanSymbol = cleanSymbol.replace('/', '-');
    return `<img src="${SCRYFALL_SYMBOLS_BASE}/${cleanSymbol}.svg" class="w-3 h-3 inline-block mx-[1px]" alt="${symbol}">`;
  });
}

export function renderCard(item: CardQuantity, type: CardType): string {
  const className = type === 'add' ? 'card-add' : type === 'remove' ? 'card-remove' : 'card-unchanged';
  const safeName = escapeHtml(item.name);

  const cached = scryfallClient.getCached(item.name);
  const manaHtml = cached ? getManaHtml(cached.manaCost) : '';
  const placeholderClass = cached ? 'mana-rendered' : 'mana-placeholder';

  return `<div class="${className} ml-4 flex items-center">
    ${item.count} <span class="card-hover text-violet-400 hover:text-violet-300 mx-1" data-name="${safeName}">${safeName}</span>
    <span class="${placeholderClass} inline-flex items-center" data-name="${safeName}">${manaHtml}</span>
  </div>`;
}

export function renderGroupedCards(items: CardQuantity[], type: CardType, mode: GroupingMode): string {
  if (mode === 'none') {
    return items
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((i) => renderCard(i, type))
      .join('');
  }

  const groups = groupItems(items, mode);

  return groups
    .map((group: CardGroup) => {
      const cardsHtml = group.items.map((i) => renderCard(i, type)).join('');
      const totalCount = group.items.reduce((sum, item) => sum + item.count, 0);
      const label = mode === 'cmc' ? `CMC ${group.label}` : group.label;

      return `<div class="mb-3">
        <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1 ml-2">${label} <span class="text-zinc-600">(${totalCount})</span></div>
        ${cardsHtml}
      </div>`;
    })
    .join('');
}

export function renderDeckPreview(text: string, previewId: string): void {
  const preview = document.getElementById(previewId);
  if (!preview) return;

  saveDeckContent(previewId === 'preview1' ? 'deck1' : 'deck2', text);

  if (!text.trim()) {
    preview.innerHTML = '';
    preview.classList.add('hidden');
    return;
  }

  preview.classList.remove('hidden');

  const lines = text.split('\n');
  const formattedHTML = lines
    .map((line) => {
      const trimmedLine = line.trim();
      const match = trimmedLine.match(/^(\d+)\s+(.+?)(?:\s+\(|$)/);

      if (match) {
        const name = match[2];
        const safeName = escapeHtml(name);

        const cached = scryfallClient.getCached(name);
        const manaHtml = cached ? getManaHtml(cached.manaCost) : '';
        const placeholderClass = cached ? 'mana-rendered' : 'mana-placeholder';

        const rest = trimmedLine.substring(match[0].length).trim();

        return `<div>
          ${match[1]} <span class="card-hover text-violet-400 font-medium" data-name="${safeName}">${safeName}</span>
          <span class="${placeholderClass} ml-1 inline-flex items-center" data-name="${safeName}">${manaHtml}</span>
          ${rest ? '...' : ''}
        </div>`;
      }

      if (trimmedLine.toUpperCase().startsWith('SIDEBOARD:')) {
        return `<div class="font-bold text-zinc-500 mt-2">${escapeHtml(trimmedLine)}</div>`;
      }

      if (trimmedLine) {
        return `<div>${escapeHtml(trimmedLine)}</div>`;
      }

      return '';
    })
    .join('');

  preview.innerHTML = formattedHTML;

  queueManaFetch(['preview1', 'preview2']);
}

export function renderDiffResults(diff: DeckDiff, mode: GroupingMode): void {
  const removeContainer = document.getElementById('diff-remove');
  const addContainer = document.getElementById('diff-add');
  const unchangedContainer = document.getElementById('diff-unchanged');

  if (removeContainer) {
    let removeHTML = '';
    if (diff.mainDiff.cuts.length > 0) {
      removeHTML += `<div class="font-bold text-zinc-400 mb-2">Mainboard</div>`;
      removeHTML += renderGroupedCards(diff.mainDiff.cuts, 'remove', mode);
    }
    if (diff.sideDiff.cuts.length > 0) {
      removeHTML += `<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>`;
      removeHTML += renderGroupedCards(diff.sideDiff.cuts, 'remove', mode);
    }
    if (!removeHTML) removeHTML = '<div class="text-zinc-500 italic">No cards removed</div>';
    removeContainer.innerHTML = removeHTML;
  }

  if (addContainer) {
    let addHTML = '';
    if (diff.mainDiff.adds.length > 0) {
      addHTML += `<div class="font-bold text-zinc-400 mb-2">Mainboard</div>`;
      addHTML += renderGroupedCards(diff.mainDiff.adds, 'add', mode);
    }
    if (diff.sideDiff.adds.length > 0) {
      addHTML += `<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>`;
      addHTML += renderGroupedCards(diff.sideDiff.adds, 'add', mode);
    }
    if (!addHTML) addHTML = '<div class="text-zinc-500 italic">No cards added</div>';
    addContainer.innerHTML = addHTML;
  }

  if (unchangedContainer) {
    let unchangedHTML = '';
    if (diff.mainDiff.unchanged.length > 0) {
      unchangedHTML += `<div class="font-bold text-zinc-400 mb-2">Mainboard</div>`;
      unchangedHTML += renderGroupedCards(diff.mainDiff.unchanged, 'unchanged', mode);
    }
    if (diff.sideDiff.unchanged.length > 0) {
      unchangedHTML += `<div class="font-bold text-zinc-400 mb-2 mt-4">Sideboard</div>`;
      unchangedHTML += renderGroupedCards(diff.sideDiff.unchanged, 'unchanged', mode);
    }
    if (!unchangedHTML) unchangedHTML = '<div class="text-zinc-500 italic">No unchanged cards</div>';
    unchangedContainer.innerHTML = unchangedHTML;
  }

  updatePrintButtonVisibility(diff);

  const allNames = getAllCardNames(diff);
  queueManaFetch(['diff-remove', 'diff-add', 'diff-unchanged'], allNames);
}

function updatePrintButtonVisibility(diff: DeckDiff): void {
  const printBtn = document.getElementById('print-btn');
  if (!printBtn) return;

  const hasAdds = diff.mainDiff.adds.length > 0 || diff.sideDiff.adds.length > 0;
  printBtn.classList.toggle('hidden', !hasAdds);
}

function queueManaFetch(containerIds: string[], additionalNames?: string[]): void {
  const names = new Set<string>(additionalNames || []);

  for (const id of containerIds) {
    const container = document.getElementById(id);
    if (container) {
      container.querySelectorAll('.mana-placeholder').forEach((el) => {
        const name = el.getAttribute('data-name');
        if (name) names.add(name);
      });
    }
  }

  if (names.size === 0) return;

  if (fetchDebounceTimer !== null) {
    clearTimeout(fetchDebounceTimer);
  }

  names.forEach((n) => pendingFetchNames.add(n));

  fetchDebounceTimer = window.setTimeout(() => {
    const batch = Array.from(pendingFetchNames);
    pendingFetchNames.clear();
    fetchDebounceTimer = null;

    executeManaFetch(batch, containerIds);
  }, FETCH_DEBOUNCE_MS);
}

async function executeManaFetch(names: string[], containerIds: string[]): Promise<void> {
  await scryfallClient.fetchCards(names);
  updateManaSymbolsInContainers(containerIds);
}

function updateManaSymbolsInContainers(containerIds: string[]): void {
  for (const containerId of containerIds) {
    const container = document.getElementById(containerId);
    if (!container) continue;

    const placeholders = container.querySelectorAll('.mana-placeholder');
    placeholders.forEach((span) => {
      const name = span.getAttribute('data-name');
      if (!name) return;

      const cached = scryfallClient.getCached(name);
      if (cached) {
        span.innerHTML = getManaHtml(cached.manaCost);
        span.classList.remove('mana-placeholder');
        span.classList.add('mana-rendered');
      }
    });
  }
}

export function updateDeckDropdowns(): void {
  const saved = localStorage.getItem('mtg-diff-saved-decks');
  const savedDecks: Record<string, string> = saved ? JSON.parse(saved) : {};
  const selects = ['saved-decks-1', 'saved-decks-2'];

  for (const id of selects) {
    const select = document.getElementById(id) as HTMLSelectElement | null;
    if (!select) continue;

    const currentValue = select.value;

    while (select.options.length > 1) {
      select.remove(1);
    }

    const deckNames = Object.keys(savedDecks).sort();

    for (const name of deckNames) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }

    if (savedDecks[currentValue]) {
      select.value = currentValue;
    } else {
      select.value = '';
    }
  }
}

export function copyToClipboard(elementId: string, btnElement: HTMLElement): void {
  const container = document.getElementById(elementId);
  if (!container) return;

  const lines: string[] = [];
  container.querySelectorAll(':scope > div').forEach((child) => {
    const line = child.textContent?.replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
  });

  const text = lines.join('\n');

  if (!text || text === 'No cards removed' || text === 'No cards added' || text === 'No unchanged cards') {
    alert('Nothing to copy.');
    return;
  }

  navigator.clipboard
    .writeText(text)
    .then(() => {
      const originalContent = btnElement.innerHTML;
      btnElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
      setTimeout(() => {
        btnElement.innerHTML = originalContent;
      }, 2000);
    })
    .catch((err) => {
      console.error('Failed to copy: ', err);
      alert('Failed to copy to clipboard');
    });
}
