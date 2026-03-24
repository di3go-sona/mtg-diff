export interface CacheNode<V> {
  key: string;
  value: V;
  prev: CacheNode<V> | null;
  next: CacheNode<V> | null;
}

export interface SerializedCache<V> {
  items: Array<{ key: string; value: V }>;
  capacity: number;
}

export class LRUCache<V> {
  private capacity: number;
  private cache: Map<string, CacheNode<V>>;
  private head: CacheNode<V> | null = null;
  private tail: CacheNode<V> | null = null;
  private onSet?: () => void;

  constructor(capacity: number, onSet?: () => void) {
    this.capacity = capacity;
    this.cache = new Map();
    this.onSet = onSet;
  }

  get(key: string): V | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    this.moveToFront(node);
    return node.value;
  }

  set(key: string, value: V): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      existingNode.value = value;
      this.moveToFront(existingNode);
      this.onSet?.();
      return;
    }

    if (this.cache.size >= this.capacity) {
      this.evictLRU();
    }

    const newNode: CacheNode<V> = {
      key,
      value,
      prev: null,
      next: this.head,
    };

    if (this.head) {
      this.head.prev = newNode;
    }
    this.head = newNode;

    if (!this.tail) {
      this.tail = newNode;
    }

    this.cache.set(key, newNode);
    this.onSet?.();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
    this.onSet?.();
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.onSet?.();
  }

  get size(): number {
    return this.cache.size;
  }

  serialize(): SerializedCache<V> {
    const items: Array<{ key: string; value: V }> = [];
    let current = this.head;

    while (current) {
      items.push({ key: current.key, value: current.value });
      current = current.next;
    }

    return {
      items,
      capacity: this.capacity,
    };
  }

  static deserialize<V>(data: SerializedCache<V>, onSet?: () => void): LRUCache<V> {
    const cache = new LRUCache<V>(data.capacity, onSet);

    for (let i = data.items.length - 1; i >= 0; i--) {
      const item = data.items[i];
      cache.set(item.key, item.value);
    }

    return cache;
  }

  keys(): string[] {
    const keys: string[] = [];
    let current = this.head;

    while (current) {
      keys.push(current.key);
      current = current.next;
    }

    return keys;
  }

  private moveToFront(node: CacheNode<V>): void {
    if (node === this.head) return;

    this.removeNode(node);
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: CacheNode<V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private evictLRU(): void {
    if (!this.tail) return;

    const lruNode = this.tail;
    this.removeNode(lruNode);
    this.cache.delete(lruNode.key);
  }
}
