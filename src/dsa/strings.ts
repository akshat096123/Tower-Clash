import { TreeVisualNode } from './trees';

// 1. Trie (Prefix Tree for Tower/Enemy/Command autocomplete)
export interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
}

export class Trie {
  private root: TrieNode = { children: new Map(), isEnd: false };

  insert(word: string): void {
    let curr = this.root;
    for (const ch of word.toLowerCase()) {
      let nxt = curr.children.get(ch);
      if (!nxt) {
        nxt = { children: new Map(), isEnd: false };
        curr.children.set(ch, nxt);
      }
      curr = nxt;
    }
    curr.isEnd = true;
  }

  search(word: string): boolean {
    let curr = this.root;
    for (const ch of word.toLowerCase()) {
      const nxt = curr.children.get(ch);
      if (!nxt) return false;
      curr = nxt;
    }
    return curr.isEnd;
  }

  autocomplete(prefix: string): string[] {
    const p = prefix.toLowerCase();
    let curr = this.root;
    for (const ch of p) {
      const nxt = curr.children.get(ch);
      if (!nxt) return [];
      curr = nxt;
    }
    const results: string[] = [];
    const dfs = (node: TrieNode, acc: string) => {
      if (node.isEnd) results.push(acc);
      for (const [ch, child] of node.children.entries()) {
        dfs(child, acc + ch);
      }
    };
    dfs(curr, p);
    return results;
  }

  toVisual(): TreeVisualNode {
    let idCounter = 0;
    const build = (node: TrieNode, label: string): TreeVisualNode => ({
      id: `trie-${++idCounter}`,
      label,
      color: node.isEnd ? 'emerald' : 'cyan',
      meta: node.isEnd ? 'END' : undefined,
      children: [...node.children.entries()].map(([ch, child]) => build(child, ch)),
    });
    return build(this.root, 'ROOT');
  }
}

// 2. Suffix Tree (Compressed Radix/Suffix Trie over text$)
export interface SuffixTreeNode {
  edgeLabel: string;
  startIndex: number | null; // leaf suffix start
  children: SuffixTreeNode[];
}

export class SuffixTree {
  readonly text: string;
  readonly root: SuffixTreeNode;

  constructor(input: string) {
    this.text = input.endsWith('$') ? input : `${input}$`;
    this.root = { edgeLabel: '', startIndex: null, children: [] };
    for (let i = 0; i < this.text.length; i++) {
      this.insertSuffix(this.text.slice(i), i);
    }
  }

  private insertSuffix(suffix: string, startIndex: number): void {
    let node = this.root;
    let remaining = suffix;

    while (remaining.length > 0) {
      let matchedChild: SuffixTreeNode | null = null;
      for (const child of node.children) {
        if (child.edgeLabel[0] === remaining[0]) {
          matchedChild = child;
          break;
        }
      }
      if (!matchedChild) {
        node.children.push({ edgeLabel: remaining, startIndex, children: [] });
        return;
      }

      const label = matchedChild.edgeLabel;
      let common = 0;
      while (common < label.length && common < remaining.length && label[common] === remaining[common]) {
        common++;
      }

      if (common === label.length) {
        node = matchedChild;
        remaining = remaining.slice(common);
      } else {
        // Split edge
        const splitNode: SuffixTreeNode = {
          edgeLabel: label.slice(0, common),
          startIndex: null,
          children: [
            {
              edgeLabel: label.slice(common),
              startIndex: matchedChild.startIndex,
              children: matchedChild.children,
            },
            {
              edgeLabel: remaining.slice(common),
              startIndex,
              children: [],
            },
          ],
        };
        const idx = node.children.indexOf(matchedChild);
        node.children[idx] = splitNode;
        return;
      }
    }
  }

  searchPattern(pattern: string): number[] {
    if (!pattern) return [];
    let node = this.root;
    let rem = pattern;
    while (rem.length > 0) {
      const child = node.children.find((c) => c.edgeLabel[0] === rem[0]);
      if (!child) return [];
      const edge = child.edgeLabel;
      const cmpLen = Math.min(edge.length, rem.length);
      for (let i = 0; i < cmpLen; i++) {
        if (edge[i] !== rem[i]) return [];
      }
      if (rem.length <= edge.length) {
        // Collect all leaf start indices under child
        const out: number[] = [];
        const collect = (n: SuffixTreeNode) => {
          if (n.startIndex !== null) out.push(n.startIndex);
          for (const ch of n.children) collect(ch);
        };
        collect(child);
        return out.sort((a, b) => a - b);
      }
      rem = rem.slice(edge.length);
      node = child;
    }
    return [];
  }

  toVisual(): TreeVisualNode {
    let cid = 0;
    const conv = (n: SuffixTreeNode): TreeVisualNode => ({
      id: `st-${++cid}`,
      label: n.edgeLabel || 'ROOT',
      color: n.startIndex !== null ? 'emerald' : 'amber',
      meta: n.startIndex !== null ? `#${n.startIndex}` : undefined,
      children: n.children.map(conv),
    });
    return conv(this.root);
  }
}

// 3. Suffix Array + LCP + Binary Search
export interface SuffixArrayEntry {
  index: number;
  suffix: string;
  lcp: number;
}

export class SuffixArray {
  readonly text: string;
  readonly entries: SuffixArrayEntry[];

  constructor(text: string) {
    this.text = text;
    const n = text.length;
    const indices: number[] = [];
    for (let i = 0; i < n; i++) indices.push(i);

    // Manual merge sort on suffix indices
    const sortRec = (arr: number[]): number[] => {
      if (arr.length <= 1) return arr;
      const mid = Math.floor(arr.length / 2);
      const l = sortRec(arr.slice(0, mid));
      const r = sortRec(arr.slice(mid));
      const res: number[] = [];
      let i = 0, j = 0;
      while (i < l.length && j < r.length) {
        if (text.slice(l[i]) <= text.slice(r[j])) res.push(l[i++]);
        else res.push(r[j++]);
      }
      while (i < l.length) res.push(l[i++]);
      while (j < r.length) res.push(r[j++]);
      return res;
    };

    const sorted = sortRec(indices);
    this.entries = sorted.map((idx, pos) => {
      let lcp = 0;
      if (pos > 0) {
        const prev = text.slice(sorted[pos - 1]);
        const curr = text.slice(idx);
        while (lcp < prev.length && lcp < curr.length && prev[lcp] === curr[lcp]) lcp++;
      }
      return { index: idx, suffix: text.slice(idx), lcp };
    });
  }

  searchPattern(pattern: string): number[] {
    if (!pattern) return [];
    const n = this.entries.length;
    let lo = 0, hi = n - 1, first = -1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const suf = this.entries[mid].suffix.slice(0, pattern.length);
      if (suf >= pattern) {
        if (suf === pattern) first = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    if (first === -1) return [];
    const matches: number[] = [];
    for (let i = first; i < n && this.entries[i].suffix.startsWith(pattern); i++) {
      matches.push(this.entries[i].index);
    }
    return matches;
  }
}

// 4. String Hashing & Rabin-Karp Pattern Matching
export interface StringHashStep {
  index: number;
  window: string;
  windowHash: number;
  patternHash: number;
  match: boolean;
  spuriousHit: boolean;
}

export function polynomialHash(str: string, base = 31, mod = 1009): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * base + str.charCodeAt(i)) % mod;
  }
  return h;
}

export function rabinKarpTrace(
  text: string,
  pattern: string,
  base = 31,
  mod = 1009
): { matches: number[]; patternHash: number; steps: StringHashStep[] } {
  const n = text.length;
  const m = pattern.length;
  const matches: number[] = [];
  const steps: StringHashStep[] = [];
  if (m === 0 || m > n) return { matches, patternHash: 0, steps };

  let h = 1;
  for (let i = 0; i < m - 1; i++) h = (h * base) % mod;

  let pHash = 0;
  let tHash = 0;
  for (let i = 0; i < m; i++) {
    pHash = (base * pHash + pattern.charCodeAt(i)) % mod;
    tHash = (base * tHash + text.charCodeAt(i)) % mod;
  }

  for (let i = 0; i <= n - m; i++) {
    const win = text.slice(i, i + m);
    let exact = false;
    let spurious = false;
    if (pHash === tHash) {
      exact = win === pattern;
      spurious = !exact;
      if (exact) matches.push(i);
    }
    steps.push({
      index: i,
      window: win,
      windowHash: tHash,
      patternHash: pHash,
      match: exact,
      spuriousHit: spurious,
    });
    if (i < n - m) {
      tHash = (base * (tHash - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % mod;
      if (tHash < 0) tHash += mod;
    }
  }
  return { matches, patternHash: pHash, steps };
}
