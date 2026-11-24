// Manual Hash Table with Separate Chaining, Linear Probing, Quadratic Probing, and Double Hashing

export type CollisionStrategy = 'chaining' | 'linear' | 'quadratic' | 'double';

export interface HashChainEntry<V> {
  key: string;
  value: V;
}

export interface HashProbeSlot<V> {
  state: 'empty' | 'occupied' | 'deleted';
  key?: string;
  value?: V;
}

export interface HashProbeStep {
  index: number;
  status: 'probe' | 'collision' | 'inserted' | 'found' | 'not_found';
  detail: string;
}

export class HashTable<V> {
  private strategy: CollisionStrategy;
  private cap: number;
  private count = 0;
  private totalCollisions = 0;
  private totalLookups = 0;
  private chains: Array<Array<HashChainEntry<V>>> = [];
  private slots: Array<HashProbeSlot<V>> = [];

  constructor(strategy: CollisionStrategy = 'chaining', initialCapacity = 17) {
    this.strategy = strategy;
    this.cap = HashTable.nextPrime(initialCapacity);
    this.initStorage();
  }

  private initStorage(): void {
    if (this.strategy === 'chaining') {
      this.chains = Array.from({ length: this.cap }, () => []);
      this.slots = [];
    } else {
      this.slots = Array.from({ length: this.cap }, () => ({ state: 'empty' }));
      this.chains = [];
    }
  }

  private static nextPrime(n: number): number {
    const isPrime = (x: number) => {
      if (x < 2) return false;
      for (let i = 2; i * i <= x; i++) {
        if (x % i === 0) return false;
      }
      return true;
    };
    let val = Math.max(5, n);
    while (!isPrime(val)) val++;
    return val;
  }

  primaryHash(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % this.cap;
  }

  secondaryHash(key: string): number {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = (h * 31 + key.charCodeAt(i)) >>> 0;
    }
    return 1 + (h % Math.max(1, this.cap - 2));
  }

  private rehash(newCap: number): void {
    const entries: Array<[string, V]> = [];
    if (this.strategy === 'chaining') {
      for (const bucket of this.chains) {
        for (const item of bucket) entries.push([item.key, item.value]);
      }
    } else {
      for (const slot of this.slots) {
        if (slot.state === 'occupied' && slot.key !== undefined && slot.value !== undefined) {
          entries.push([slot.key, slot.value]);
        }
      }
    }
    this.cap = HashTable.nextPrime(newCap);
    this.count = 0;
    this.initStorage();
    for (const [k, v] of entries) {
      this.insert(k, v);
    }
  }

  insert(key: string, value: V): HashProbeStep[] {
    const loadFactor = (this.count + 1) / this.cap;
    if ((this.strategy === 'chaining' && loadFactor > 0.85) ||
        (this.strategy !== 'chaining' && loadFactor > 0.65)) {
      this.rehash(this.cap * 2);
    }

    const steps: HashProbeStep[] = [];
    const h1 = this.primaryHash(key);

    if (this.strategy === 'chaining') {
      const bucket = this.chains[h1];
      if (bucket.length > 0) {
        this.totalCollisions++;
        steps.push({ index: h1, status: 'collision', detail: `Collision at bucket ${h1} (chain length ${bucket.length})` });
      }
      for (let i = 0; i < bucket.length; i++) {
        if (bucket[i].key === key) {
          bucket[i].value = value;
          steps.push({ index: h1, status: 'inserted', detail: `Updated existing key "${key}" in bucket ${h1}` });
          return steps;
        }
      }
      bucket.push({ key, value });
      this.count++;
      steps.push({ index: h1, status: 'inserted', detail: `Appended "${key}" to chain at bucket ${h1}` });
      return steps;
    }

    const h2 = this.secondaryHash(key);
    let firstDeleted = -1;
    for (let i = 0; i < this.cap; i++) {
      const idx =
        this.strategy === 'linear'
          ? (h1 + i) % this.cap
          : this.strategy === 'quadratic'
          ? (h1 + i * i) % this.cap
          : (h1 + i * h2) % this.cap;

      const slot = this.slots[idx];
      if (slot.state === 'empty') {
        const target = firstDeleted !== -1 ? firstDeleted : idx;
        this.slots[target] = { state: 'occupied', key, value };
        this.count++;
        steps.push({ index: target, status: 'inserted', detail: `Inserted "${key}" at slot ${target} after ${i} probe(s)` });
        return steps;
      }
      if (slot.state === 'deleted') {
        if (firstDeleted === -1) firstDeleted = idx;
        steps.push({ index: idx, status: 'probe', detail: `Slot ${idx} is tombstone (deleted), continue probing` });
      } else if (slot.key === key) {
        slot.value = value;
        steps.push({ index: idx, status: 'inserted', detail: `Updated "${key}" at slot ${idx}` });
        return steps;
      } else {
        this.totalCollisions++;
        steps.push({
          index: idx,
          status: 'collision',
          detail: `Collision at slot ${idx} (occupied by "${slot.key}"), step i=${i + 1}`,
        });
      }
    }
    return steps;
  }

  get(key: string): V | undefined {
    this.totalLookups++;
    const h1 = this.primaryHash(key);
    if (this.strategy === 'chaining') {
      for (const item of this.chains[h1]) {
        if (item.key === key) return item.value;
      }
      return undefined;
    }
    const h2 = this.secondaryHash(key);
    for (let i = 0; i < this.cap; i++) {
      const idx =
        this.strategy === 'linear'
          ? (h1 + i) % this.cap
          : this.strategy === 'quadratic'
          ? (h1 + i * i) % this.cap
          : (h1 + i * h2) % this.cap;
      const slot = this.slots[idx];
      if (slot.state === 'empty') return undefined;
      if (slot.state === 'occupied' && slot.key === key) return slot.value;
    }
    return undefined;
  }

  remove(key: string): boolean {
    const h1 = this.primaryHash(key);
    if (this.strategy === 'chaining') {
      const bucket = this.chains[h1];
      for (let i = 0; i < bucket.length; i++) {
        if (bucket[i].key === key) {
          bucket.splice(i, 1);
          this.count--;
          return true;
        }
      }
      return false;
    }
    const h2 = this.secondaryHash(key);
    for (let i = 0; i < this.cap; i++) {
      const idx =
        this.strategy === 'linear'
          ? (h1 + i) % this.cap
          : this.strategy === 'quadratic'
          ? (h1 + i * i) % this.cap
          : (h1 + i * h2) % this.cap;
      const slot = this.slots[idx];
      if (slot.state === 'empty') return false;
      if (slot.state === 'occupied' && slot.key === key) {
        this.slots[idx] = { state: 'deleted' };
        this.count--;
        return true;
      }
    }
    return false;
  }

  entries(): Array<[string, V]> {
    const out: Array<[string, V]> = [];
    if (this.strategy === 'chaining') {
      for (const b of this.chains) {
        for (const item of b) out.push([item.key, item.value]);
      }
    } else {
      for (const s of this.slots) {
        if (s.state === 'occupied' && s.key !== undefined && s.value !== undefined) {
          out.push([s.key, s.value]);
        }
      }
    }
    return out;
  }

  inspectState() {
    return {
      strategy: this.strategy,
      capacity: this.cap,
      size: this.count,
      loadFactor: Number((this.count / this.cap).toFixed(3)),
      collisions: this.totalCollisions,
      lookups: this.totalLookups,
      chains: this.chains,
      slots: this.slots,
    };
  }
}
