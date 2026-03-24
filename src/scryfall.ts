import { CardData, CardType, getCardType } from './card';
import { LRUCache } from './cache';

interface ScryfallCardResponse {
  name: string;
  mana_cost?: string;
  type_line?: string;
  cmc?: number;
  card_faces?: Array<{
    mana_cost?: string;
    type_line?: string;
  }>;
}

interface ScryfallCollectionResponse {
  data: ScryfallCardResponse[];
  not_found?: Array<{ name: string }>;
}

interface ScryfallCollectionRequest {
  identifiers: Array<{ name: string }>;
}

const SCRYFALL_API_BASE = 'https://api.scryfall.com';
const RATE_LIMIT_MS = 50;
const MAX_BATCH_SIZE = 75;
const CACHE_CAPACITY = 500;

export class ScryfallClient {
  private lastRequestTime = 0;
  private pendingQueue: Array<{
    names: string[];
    resolve: (cards: Map<string, CardData>) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessing = false;
  private cache: LRUCache<CardData>;

  constructor(cacheCapacity = CACHE_CAPACITY) {
    this.cache = new LRUCache<CardData>(cacheCapacity);
  }

  async fetchCards(names: string[]): Promise<Map<string, CardData>> {
    const result = new Map<string, CardData>();
    const toFetch: string[] = [];

    for (const name of names) {
      const cached = this.cache.get(name);
      if (cached) {
        result.set(name, cached);
      } else {
        toFetch.push(name);
      }
    }

    if (toFetch.length === 0) {
      return result;
    }

    const fetched = await this.queueFetchRequest(toFetch);
    for (const [name, card] of fetched) {
      result.set(name, card);
    }

    return result;
  }

  getCached(name: string): CardData | undefined {
    return this.cache.get(name);
  }

  isCached(name: string): boolean {
    return this.cache.has(name);
  }

  getCardType(name: string): CardType {
    const card = this.cache.get(name);
    return card ? getCardType(card.typeLine) : 'Unknown';
  }

  private async queueFetchRequest(names: string[]): Promise<Map<string, CardData>> {
    return new Promise((resolve, reject) => {
      this.pendingQueue.push({ names, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.pendingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.pendingQueue.length > 0) {
      const batch = this.pendingQueue.shift()!;
      try {
        const cards = await this.executeBatchFetch(batch.names);
        batch.resolve(cards);
      } catch (error) {
        batch.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessing = false;
  }

  private async executeBatchFetch(names: string[]): Promise<Map<string, CardData>> {
    const result = new Map<string, CardData>();
    const uniqueNames = [...new Set(names)];

    const chunks: string[][] = [];
    for (let i = 0; i < uniqueNames.length; i += MAX_BATCH_SIZE) {
      chunks.push(uniqueNames.slice(i, i + MAX_BATCH_SIZE));
    }

    for (const chunk of chunks) {
      await this.enforceRateLimit();

      try {
        const response = await fetch(`${SCRYFALL_API_BASE}/cards/collection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifiers: chunk.map((name) => ({ name })),
          } as ScryfallCollectionRequest),
        });

        if (!response.ok) {
          throw new Error(`Scryfall API error: ${response.status}`);
        }

        const data: ScryfallCollectionResponse = await response.json();

        if (data.data) {
          for (const card of data.data) {
            const cardData = this.parseCardResponse(card);
            result.set(card.name, cardData);
            this.cache.set(card.name, cardData);
          }
        }

        if (data.not_found) {
          for (const item of data.not_found) {
            const emptyCard: CardData = {
              name: item.name,
              manaCost: '',
              typeLine: '',
              cmc: 0,
            };
            result.set(item.name, emptyCard);
            this.cache.set(item.name, emptyCard);
          }
        }
      } catch (error) {
        console.error('Failed to fetch cards from Scryfall:', error);
        for (const name of chunk) {
          result.set(name, {
            name,
            manaCost: '',
            typeLine: '',
            cmc: 0,
          });
        }
      }
    }

    return result;
  }

  private parseCardResponse(card: ScryfallCardResponse): CardData {
    let manaCost = card.mana_cost || '';
    let typeLine = card.type_line || '';
    const cmc = card.cmc || 0;

    if (!manaCost && card.card_faces && card.card_faces.length > 0) {
      manaCost = card.card_faces[0].mana_cost || '';
    }

    if (!typeLine && card.card_faces && card.card_faces.length > 0) {
      typeLine = card.card_faces[0].type_line || '';
    }

    return {
      name: card.name,
      manaCost,
      typeLine,
      cmc,
    };
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const remaining = RATE_LIMIT_MS - elapsed;

    if (remaining > 0) {
      await this.delay(remaining);
    }

    this.lastRequestTime = Date.now();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const scryfallClient = new ScryfallClient();
