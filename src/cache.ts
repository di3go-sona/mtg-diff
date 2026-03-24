export interface CacheNode<V> {
  key: string;
  value: V;
  prev: CacheNode<V> | null;
  next: CacheNode<V> | null;
}

export class LRUCache<V> {
  private capacity: number;
  private cache: Map<string, CacheNode<V>>;
  private head: CacheNode<V> | null = null;
  private tail: CacheNode<V> | null = null;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
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
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  get size(): number {
    return this.cache.size;
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
