import { GroupingMode } from './card';

const STORAGE_KEYS = {
  DECK_1: 'deck1',
  DECK_2: 'deck2',
  SAVED_DECKS: 'mtg-diff-saved-decks',
  GROUPING_MODE: 'mtg-diff-grouping',
  SECTION_VISIBILITY: 'mtg-diff-section',
} as const;

type SectionId = 'section-remove' | 'section-unchanged' | 'section-add';

function isLocalStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

const storageAvailable = isLocalStorageAvailable();

function safeGetItem(key: string): string | null {
  if (!storageAvailable) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (!storageAvailable) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    console.warn(`Failed to save to localStorage: ${key}`);
  }
}

function safeRemoveItem(key: string): void {
  if (!storageAvailable) return;
  try {
    localStorage.removeItem(key);
  } catch {
    console.warn(`Failed to remove from localStorage: ${key}`);
  }
}

export function saveDeckContent(deckId: string, content: string): void {
  safeSetItem(deckId, content);
}

export function loadDeckContent(deckId: string): string | null {
  return safeGetItem(deckId);
}

export function getSavedDecks(): Record<string, string> {
  const saved = safeGetItem(STORAGE_KEYS.SAVED_DECKS);
  if (!saved) return {};
  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

export function saveDeck(name: string, content: string): void {
  const savedDecks = getSavedDecks();
  savedDecks[name] = content;
  safeSetItem(STORAGE_KEYS.SAVED_DECKS, JSON.stringify(savedDecks));
}

export function deleteDeck(name: string): void {
  const savedDecks = getSavedDecks();
  delete savedDecks[name];
  safeSetItem(STORAGE_KEYS.SAVED_DECKS, JSON.stringify(savedDecks));
}

export function getGroupingMode(): GroupingMode {
  const saved = safeGetItem(STORAGE_KEYS.GROUPING_MODE);
  if (saved && ['none', 'category', 'cmc'].includes(saved)) {
    return saved as GroupingMode;
  }
  return 'none';
}

export function setGroupingMode(mode: GroupingMode): void {
  safeSetItem(STORAGE_KEYS.GROUPING_MODE, mode);
}

export function getSectionVisibility(sectionId: SectionId): boolean {
  const key = `${STORAGE_KEYS.SECTION_VISIBILITY}-${sectionId}`;
  const saved = safeGetItem(key);
  return saved !== 'hidden';
}

export function setSectionVisibility(sectionId: SectionId, visible: boolean): void {
  const key = `${STORAGE_KEYS.SECTION_VISIBILITY}-${sectionId}`;
  safeSetItem(key, visible ? 'visible' : 'hidden');
}

export function clearAllData(): void {
  safeRemoveItem(STORAGE_KEYS.DECK_1);
  safeRemoveItem(STORAGE_KEYS.DECK_2);
  safeRemoveItem(STORAGE_KEYS.SAVED_DECKS);
  safeRemoveItem(STORAGE_KEYS.GROUPING_MODE);
}

export { STORAGE_KEYS };
