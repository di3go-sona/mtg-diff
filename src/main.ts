import { DeckDiff, GroupingMode } from './card';
import { parseDeck } from './deckParser';
import { calculateDeckDiff } from './diff';
import {
  saveDeckContent,
  loadDeckContent,
  getSavedDecks,
  saveDeck,
  getGroupingMode,
  setGroupingMode,
  getSectionVisibility,
  setSectionVisibility,
} from './storage';
import { renderDeckPreview, renderDiffResults, copyToClipboard, updateDeckDropdowns } from './ui';
import { generatePrintPage } from './print';

let currentDiff: DeckDiff | null = null;
let currentGroupingMode: GroupingMode = 'none';

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function initApp(): void {
  currentGroupingMode = getGroupingMode();
  initGroupingSelect();
  initSectionVisibility();
  initSavedDecks();
  initDeckInputs();
  initTooltip();
  initGlobalFunctions();
}

function initGroupingSelect(): void {
  const select = $('grouping-select') as HTMLSelectElement | null;
  if (select) {
    select.value = currentGroupingMode;
    select.addEventListener('change', () => {
      setGrouping(select.value as GroupingMode);
    });
  }
}

function initSectionVisibility(): void {
  const sections: Array<{ id: 'section-remove' | 'section-unchanged' | 'section-add'; checkbox: string }> = [
    { id: 'section-remove', checkbox: 'show-removes' },
    { id: 'section-unchanged', checkbox: 'show-unchanged' },
    { id: 'section-add', checkbox: 'show-adds' },
  ];

  for (const { id, checkbox } of sections) {
    const section = $(id);
    const checkboxEl = $(checkbox) as HTMLInputElement | null;

    if (!getSectionVisibility(id) && section && checkboxEl) {
      section.classList.add('hidden');
      checkboxEl.checked = false;
    }
  }
}

function initSavedDecks(): void {
  updateDeckDropdowns();
}

function initDeckInputs(): void {
  const deck1 = $('deck1') as HTMLTextAreaElement | null;
  const deck2 = $('deck2') as HTMLTextAreaElement | null;

  if (deck1) {
    const saved = loadDeckContent('deck1');
    if (saved) {
      deck1.value = saved;
      renderDeckPreview(saved, 'preview1');
    }
  }

  if (deck2) {
    const saved = loadDeckContent('deck2');
    if (saved) {
      deck2.value = saved;
      renderDeckPreview(saved, 'preview2');
    }
  }
}

function initTooltip(): void {
  const tooltip = $('card-tooltip') as HTMLImageElement | null;
  if (!tooltip) return;

  let currentCardName: string | null = null;

  document.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('card-hover')) {
      const cardName = target.getAttribute('data-name');
      if (cardName && currentCardName !== cardName) {
        currentCardName = cardName;
        tooltip.src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&format=image`;
        tooltip.style.display = 'block';
      } else if (cardName) {
        tooltip.style.display = 'block';
      }
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (tooltip.style.display === 'block') {
      const xOffset = 20;
      const yOffset = 20;
      let left = e.clientX + xOffset;
      let top = e.clientY + yOffset;

      if (left + 260 > window.innerWidth) {
        left = e.clientX - 260;
      }
      if (top + 360 > window.innerHeight) {
        top = e.clientY - 360;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('card-hover')) {
      tooltip.style.display = 'none';
      currentCardName = null;
      tooltip.src = '';
    }
  });
}

function initGlobalFunctions(): void {
  (window as any).updatePreview = handleUpdatePreview;
  (window as any).calculateDiff = handleCalculateDiff;
  (window as any).setGroupingMode = setGrouping;
  (window as any).toggleSectionCheckbox = handleToggleSection;
  (window as any).copyToClipboard = handleCopyToClipboard;
  (window as any).printAddedCards = handlePrint;
  (window as any).saveDeck = handleSaveDeck;
  (window as any).loadDeck = handleLoadDeck;
  (window as any).clearDeck = handleClearDeck;
}

function handleUpdatePreview(inputId: string, previewId: string): void {
  const input = $(inputId) as HTMLTextAreaElement | null;
  if (!input) return;

  saveDeckContent(inputId, input.value);
  renderDeckPreview(input.value, previewId);
}

function handleCalculateDiff(): void {
  const deck1 = $('deck1') as HTMLTextAreaElement | null;
  const deck2 = $('deck2') as HTMLTextAreaElement | null;
  const results = $('results');

  if (!deck1 || !deck2 || !results) return;

  handleUpdatePreview('deck1', 'preview1');
  handleUpdatePreview('deck2', 'preview2');

  const d1 = parseDeck(deck1.value);
  const d2 = parseDeck(deck2.value);

  currentDiff = calculateDeckDiff(d1, d2);

  renderDiffResults(currentDiff, currentGroupingMode);

  results.classList.remove('hidden');
}

function setGrouping(mode: GroupingMode): void {
  currentGroupingMode = mode;
  setGroupingMode(mode);

  if (currentDiff) {
    renderDiffResults(currentDiff, currentGroupingMode);
  }
}

function handleToggleSection(sectionId: string, checkbox: HTMLInputElement): void {
  const section = $(sectionId);
  if (!section) return;

  if (checkbox.checked) {
    section.classList.remove('hidden');
  } else {
    section.classList.add('hidden');
  }

  setSectionVisibility(sectionId as 'section-remove' | 'section-unchanged' | 'section-add', checkbox.checked);
}

function handleCopyToClipboard(elementId: string, btnElement: HTMLElement): void {
  copyToClipboard(elementId, btnElement);
}

function handlePrint(): void {
  if (!currentDiff) {
    handleCalculateDiff();
  }

  if (currentDiff) {
    generatePrintPage(currentDiff);
  }
}

function handleSaveDeck(deckId: string, nameInputId: string): void {
  const deckContent = $(deckId) as HTMLTextAreaElement | null;
  const nameInput = $(nameInputId) as HTMLInputElement | null;

  if (!deckContent || !nameInput) return;

  const deckName = nameInput.value.trim();

  if (!deckName) {
    alert('Please enter a name for the deck.');
    return;
  }

  if (!deckContent.value.trim()) {
    alert('The deck is empty. Cannot save.');
    return;
  }

  const savedDecks = getSavedDecks();

  if (savedDecks[deckName] && !confirm(`Overwrite existing deck "${deckName}"?`)) {
    return;
  }

  saveDeck(deckName, deckContent.value);
  updateDeckDropdowns();
  nameInput.value = '';

  const colIndex = deckId === 'deck1' ? '1' : '2';
  const dropDown = $(`saved-decks-${colIndex}`) as HTMLSelectElement | null;
  if (dropDown) dropDown.value = deckName;
}

function handleLoadDeck(deckId: string, deckName: string, _selectId: string): void {
  if (!deckName) return;

  const savedDecks = getSavedDecks();
  const content = savedDecks[deckName];

  if (content) {
    const deckEl = $(deckId) as HTMLTextAreaElement | null;
    if (deckEl) {
      deckEl.value = content;
      const previewId = deckId === 'deck1' ? 'preview1' : 'preview2';
      renderDeckPreview(content, previewId);
    }
  }
}

function handleClearDeck(deckId: string): void {
  if (!confirm('Are you sure you want to clear this deck?')) return;

  const deckEl = $(deckId) as HTMLTextAreaElement | null;
  if (deckEl) {
    deckEl.value = '';
    const previewId = deckId === 'deck1' ? 'preview1' : 'preview2';
    renderDeckPreview('', previewId);
  }

  const colIndex = deckId === 'deck1' ? '1' : '2';
  const dropDown = $(`saved-decks-${colIndex}`) as HTMLSelectElement | null;
  if (dropDown) dropDown.value = '';
}

window.addEventListener('load', initApp);
