import { SortAlgorithmType } from '../types/game';

export interface SortMetrics {
  comparisons: number;
  swaps: number;
  recursiveCalls: number;
  operations: number;
  memoryBytes: number;
  durationMs: number;
}

export interface SortStep {
  array: number[];
  comparing: number[];
  swapping: number[];
  sortedIndices: number[];
  range?: [number, number];
  description: string;
  comparisons: number;
  swaps: number;
}

export interface SortTraceResult {
  sorted: number[];
  metrics: SortMetrics;
  steps: SortStep[];
}

// Generic manual sorter used inside the Game Engine for Tower Targeting Strategies
export function manualSortWithComparator<T>(
  items: T[],
  algo: SortAlgorithmType,
  compareFn: (a: T, b: T) => number,
  numericKey?: (item: T) => number
): { sorted: T[]; comparisons: number; swaps: number } {
  const arr = [...items];
  const n = arr.length;
  let comparisons = 0;
  let swaps = 0;

  if (n <= 1) return { sorted: arr, comparisons, swaps };

  const swap = (i: number, j: number) => {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    swaps++;
  };

  if (algo === 'bubble') {
    for (let i = 0; i < n - 1; i++) {
      let changed = false;
      for (let j = 0; j < n - i - 1; j++) {
        comparisons++;
        if (compareFn(arr[j], arr[j + 1]) > 0) {
          swap(j, j + 1);
          changed = true;
        }
      }
      if (!changed) break;
    }
    return { sorted: arr, comparisons, swaps };
  }

  if (algo === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      for (let j = i + 1; j < n; j++) {
        comparisons++;
        if (compareFn(arr[j], arr[minIdx]) < 0) minIdx = j;
      }
      if (minIdx !== i) swap(i, minIdx);
    }
    return { sorted: arr, comparisons, swaps };
  }

  if (algo === 'insertion') {
    for (let i = 1; i < n; i++) {
      const key = arr[i];
      let j = i - 1;
      while (j >= 0) {
        comparisons++;
        if (compareFn(arr[j], key) > 0) {
          arr[j + 1] = arr[j];
          swaps++;
          j--;
        } else {
          break;
        }
      }
      arr[j + 1] = key;
    }
    return { sorted: arr, comparisons, swaps };
  }

  if (algo === 'merge') {
    const mergeSortRec = (l: number, r: number) => {
      if (l >= r) return;
      const mid = l + Math.floor((r - l) / 2);
      mergeSortRec(l, mid);
      mergeSortRec(mid + 1, r);
      const left = arr.slice(l, mid + 1);
      const right = arr.slice(mid + 1, r + 1);
      let i = 0, j = 0, k = l;
      while (i < left.length && j < right.length) {
        comparisons++;
        if (compareFn(left[i], right[j]) <= 0) {
          arr[k++] = left[i++];
        } else {
          arr[k++] = right[j++];
          swaps++;
        }
      }
      while (i < left.length) arr[k++] = left[i++];
      while (j < right.length) arr[k++] = right[j++];
    };
    mergeSortRec(0, n - 1);
    return { sorted: arr, comparisons, swaps };
  }

  if (algo === 'radix' || algo === 'counting' || algo === 'bucket') {
    if (numericKey) {
      // Bucket-assisted stable grouping using integer keys, then insertion sort ties
      const keys = arr.map((it) => Math.max(0, Math.round(numericKey(it))));
      let maxK = keys[0];
      for (let i = 1; i < n; i++) {
        comparisons++;
        if (keys[i] > maxK) maxK = keys[i];
      }
      const bCount = Math.min(32, Math.max(4, Math.floor(Math.sqrt(n)) + 1));
      const buckets: T[][] = Array.from({ length: bCount }, () => []);
      const span = maxK + 1;
      for (let i = 0; i < n; i++) {
        const b = Math.min(bCount - 1, Math.floor((keys[i] / span) * bCount));
        buckets[b].push(arr[i]);
        swaps++;
      }
      let idx = 0;
      for (const bkt of buckets) {
        for (let i = 1; i < bkt.length; i++) {
          const item = bkt[i];
          let j = i - 1;
          while (j >= 0) {
            comparisons++;
            if (compareFn(bkt[j], item) > 0) {
              bkt[j + 1] = bkt[j];
              swaps++;
              j--;
            } else break;
          }
          bkt[j + 1] = item;
        }
        for (const item of bkt) arr[idx++] = item;
      }
      return { sorted: arr, comparisons, swaps };
    }
  }

  // Default / Quick Sort
  const quickSortRec = (lo: number, hi: number) => {
    if (lo >= hi) return;
    const pivot = arr[hi];
    let i = lo - 1;
    for (let j = lo; j < hi; j++) {
      comparisons++;
      if (compareFn(arr[j], pivot) <= 0) {
        i++;
        if (i !== j) swap(i, j);
      }
    }
    swap(i + 1, hi);
    const p = i + 1;
    quickSortRec(lo, p - 1);
    quickSortRec(p + 1, hi);
  };
  quickSortRec(0, n - 1);
  return { sorted: arr, comparisons, swaps };
}

export const SORT_LABELS: Record<SortAlgorithmType, string> = {
  bubble: 'Bubble Sort',
  selection: 'Selection Sort',
  insertion: 'Insertion Sort',
  merge: 'Merge Sort',
  quick: 'Quick Sort',
  radix: 'Radix Sort',
  bucket: 'Bucket Sort',
  counting: 'Counting Sort',
};

// Animated Step-by-Step Sort Execution for DSA Laboratory
export function runSortTrace(input: number[], algo: SortAlgorithmType): SortTraceResult {
  const arr = [...input];
  const n = arr.length;
  const steps: SortStep[] = [];
  let comparisons = 0;
  let swaps = 0;
  let recursiveCalls = 0;
  let operations = 0;
  const sortedSet = new Set<number>();

  const pushStep = (
    comparing: number[],
    swapping: number[],
    description: string,
    range?: [number, number]
  ) => {
    if (steps.length < 400) {
      steps.push({
        array: [...arr],
        comparing,
        swapping,
        sortedIndices: [...sortedSet],
        range,
        description,
        comparisons,
        swaps,
      });
    }
  };

  const t0 = performance.now();

  if (algo === 'bubble') {
    for (let i = 0; i < n - 1; i++) {
      let swapped = false;
      for (let j = 0; j < n - i - 1; j++) {
        comparisons++;
        operations++;
        pushStep([j, j + 1], [], `Compare arr[${j}]=${arr[j]} and arr[${j + 1}]=${arr[j + 1]}`);
        if (arr[j] > arr[j + 1]) {
          [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
          swaps++;
          operations += 3;
          swapped = true;
          pushStep([], [j, j + 1], `Swap ${arr[j + 1]} <-> ${arr[j]}`);
        }
      }
      sortedSet.add(n - 1 - i);
      if (!swapped) break;
    }
    for (let i = 0; i < n; i++) sortedSet.add(i);
  } else if (algo === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      for (let j = i + 1; j < n; j++) {
        comparisons++;
        operations++;
        pushStep([minIdx, j], [], `Scanning minimum: arr[${j}]=${arr[j]} vs current min arr[${minIdx}]=${arr[minIdx]}`);
        if (arr[j] < arr[minIdx]) minIdx = j;
      }
      if (minIdx !== i) {
        [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
        swaps++;
        operations += 3;
        pushStep([], [i, minIdx], `Place minimum ${arr[i]} at index ${i}`);
      }
      sortedSet.add(i);
    }
    sortedSet.add(n - 1);
  } else if (algo === 'insertion') {
    sortedSet.add(0);
    for (let i = 1; i < n; i++) {
      const key = arr[i];
      let j = i - 1;
      pushStep([i], [], `Pick key arr[${i}]=${key} to insert into sorted prefix [0..${i - 1}]`);
      while (j >= 0) {
        comparisons++;
        operations++;
        if (arr[j] > key) {
          arr[j + 1] = arr[j];
          swaps++;
          operations++;
          pushStep([], [j, j + 1], `Shift arr[${j}]=${arr[j]} right to index ${j + 1}`);
          j--;
        } else {
          break;
        }
      }
      arr[j + 1] = key;
      sortedSet.add(i);
      pushStep([], [j + 1], `Inserted key ${key} at index ${j + 1}`);
    }
  } else if (algo === 'merge') {
    const mergeSortRec = (lo: number, hi: number) => {
      recursiveCalls++;
      if (lo >= hi) return;
      const mid = lo + Math.floor((hi - lo) / 2);
      pushStep([], [], `Divide range [${lo}..${hi}] at mid=${mid}`, [lo, hi]);
      mergeSortRec(lo, mid);
      mergeSortRec(mid + 1, hi);

      const left = arr.slice(lo, mid + 1);
      const right = arr.slice(mid + 1, hi + 1);
      let i = 0, j = 0, k = lo;
      while (i < left.length && j < right.length) {
        comparisons++;
        operations++;
        if (left[i] <= right[j]) {
          arr[k] = left[i++];
        } else {
          arr[k] = right[j++];
          swaps++;
        }
        pushStep([], [k], `Merge into index ${k}: value=${arr[k]}`, [lo, hi]);
        k++;
      }
      while (i < left.length) {
        arr[k] = left[i++];
        operations++;
        pushStep([], [k], `Copy remaining left element ${arr[k]} to ${k}`, [lo, hi]);
        k++;
      }
      while (j < right.length) {
        arr[k] = right[j++];
        operations++;
        pushStep([], [k], `Copy remaining right element ${arr[k]} to ${k}`, [lo, hi]);
        k++;
      }
    };
    mergeSortRec(0, n - 1);
    for (let i = 0; i < n; i++) sortedSet.add(i);
  } else if (algo === 'quick') {
    const quickRec = (lo: number, hi: number) => {
      recursiveCalls++;
      if (lo >= hi) {
        if (lo === hi) sortedSet.add(lo);
        return;
      }
      const pivot = arr[hi];
      let i = lo - 1;
      pushStep([hi], [], `QuickSort partition [${lo}..${hi}] using pivot arr[${hi}]=${pivot}`, [lo, hi]);
      for (let j = lo; j < hi; j++) {
        comparisons++;
        operations++;
        pushStep([j, hi], [], `Compare arr[${j}]=${arr[j]} <= pivot ${pivot}`, [lo, hi]);
        if (arr[j] <= pivot) {
          i++;
          if (i !== j) {
            [arr[i], arr[j]] = [arr[j], arr[i]];
            swaps++;
            operations += 3;
            pushStep([], [i, j], `Swap arr[${i}] and arr[${j}]`, [lo, hi]);
          }
        }
      }
      [arr[i + 1], arr[hi]] = [arr[hi], arr[i + 1]];
      swaps++;
      const p = i + 1;
      sortedSet.add(p);
      pushStep([], [p], `Pivot ${pivot} locked at final index ${p}`, [lo, hi]);
      quickRec(lo, p - 1);
      quickRec(p + 1, hi);
    };
    quickRec(0, n - 1);
    for (let i = 0; i < n; i++) sortedSet.add(i);
  } else if (algo === 'counting') {
    if (n > 0) {
      let minV = arr[0], maxV = arr[0];
      for (let i = 1; i < n; i++) {
        comparisons += 2;
        if (arr[i] < minV) minV = arr[i];
        if (arr[i] > maxV) maxV = arr[i];
      }
      const range = Math.min(2000, maxV - minV + 1);
      const count = new Array<number>(range).fill(0);
      for (let i = 0; i < n; i++) {
        const idx = Math.max(0, Math.min(range - 1, arr[i] - minV));
        count[idx]++;
        operations++;
        pushStep([i], [], `Count frequency of ${arr[i]} (bucket ${idx})`);
      }
      let outIdx = 0;
      for (let b = 0; b < range; b++) {
        while (count[b] > 0) {
          arr[outIdx] = b + minV;
          swaps++;
          operations++;
          sortedSet.add(outIdx);
          pushStep([], [outIdx], `Write value ${arr[outIdx]} from count array to index ${outIdx}`);
          outIdx++;
          count[b]--;
        }
      }
    }
  } else if (algo === 'radix') {
    if (n > 0) {
      const minV = Math.min(...arr);
      const shift = minV < 0 ? -minV : 0;
      for (let i = 0; i < n; i++) arr[i] += shift;
      const maxV = Math.max(...arr);
      for (let exp = 1; Math.floor(maxV / exp) > 0; exp *= 10) {
        const output = new Array<number>(n).fill(0);
        const count = new Array<number>(10).fill(0);
        for (let i = 0; i < n; i++) {
          count[Math.floor(arr[i] / exp) % 10]++;
          operations++;
        }
        for (let i = 1; i < 10; i++) count[i] += count[i - 1];
        for (let i = n - 1; i >= 0; i--) {
          const d = Math.floor(arr[i] / exp) % 10;
          output[count[d] - 1] = arr[i];
          count[d]--;
          swaps++;
        }
        for (let i = 0; i < n; i++) {
          arr[i] = output[i];
          operations++;
        }
        pushStep([], Array.from({ length: n }, (_, k) => k), `Radix pass completed for 10^${Math.round(Math.log10(exp))} digit`);
      }
      if (shift > 0) {
        for (let i = 0; i < n; i++) arr[i] -= shift;
      }
      for (let i = 0; i < n; i++) sortedSet.add(i);
    }
  } else if (algo === 'bucket') {
    if (n > 0) {
      let minV = arr[0], maxV = arr[0];
      for (let i = 1; i < n; i++) {
        comparisons += 2;
        if (arr[i] < minV) minV = arr[i];
        if (arr[i] > maxV) maxV = arr[i];
      }
      const bucketCount = Math.max(2, Math.floor(Math.sqrt(n)));
      const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
      const span = maxV - minV + 1;
      for (let i = 0; i < n; i++) {
        const bIdx = Math.min(bucketCount - 1, Math.floor(((arr[i] - minV) / span) * bucketCount));
        buckets[bIdx].push(arr[i]);
        operations++;
        pushStep([i], [], `Distribute ${arr[i]} into bucket #${bIdx}`);
      }
      let outIdx = 0;
      for (let b = 0; b < bucketCount; b++) {
        const bkt = buckets[b];
        for (let i = 1; i < bkt.length; i++) {
          const key = bkt[i];
          let j = i - 1;
          while (j >= 0) {
            comparisons++;
            if (bkt[j] > key) {
              bkt[j + 1] = bkt[j];
              swaps++;
              j--;
            } else break;
          }
          bkt[j + 1] = key;
        }
        for (const val of bkt) {
          arr[outIdx] = val;
          sortedSet.add(outIdx);
          pushStep([], [outIdx], `Gather sorted bucket #${b} element ${val} into index ${outIdx}`);
          outIdx++;
        }
      }
    }
  }

  pushStep([], [], `Completed ${algo.toUpperCase()} sort (${comparisons} comparisons, ${swaps} swaps/writes).`);
  const durationMs = performance.now() - t0;

  return {
    sorted: arr,
    metrics: {
      comparisons,
      swaps,
      recursiveCalls,
      operations,
      memoryBytes: algo === 'merge' || algo === 'radix' ? n * 8 : algo === 'quick' ? Math.ceil(Math.log2(Math.max(2, n))) * 32 : 32,
      durationMs,
    },
    steps,
  };
}
