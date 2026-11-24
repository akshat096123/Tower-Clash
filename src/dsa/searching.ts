// Manual Searching Algorithms: Linear Search, Binary Search, and Median-Based Search (Median-of-Medians)

export interface SearchStep {
  array: number[];
  activeIndices: number[];
  range?: [number, number];
  pivotIndex?: number;
  foundIndex?: number;
  description: string;
  comparisons: number;
}

export interface SearchTraceResult {
  foundIndex: number;
  foundValue: number | null;
  comparisons: number;
  operations: number;
  steps: SearchStep[];
  durationMs: number;
}

export function linearSearchTrace(arr: number[], target: number): SearchTraceResult {
  const t0 = performance.now();
  const data = [...arr];
  const steps: SearchStep[] = [];
  let comparisons = 0;
  let operations = 0;
  let foundIndex = -1;

  for (let i = 0; i < data.length; i++) {
    comparisons++;
    operations++;
    const match = data[i] === target;
    steps.push({
      array: [...data],
      activeIndices: [i],
      foundIndex: match ? i : undefined,
      description: match
        ? `Match found at index ${i}: arr[${i}] == ${target}`
        : `Compare arr[${i}] (${data[i]}) with target ${target} -> mismatch`,
      comparisons,
    });
    if (match) {
      foundIndex = i;
      break;
    }
  }
  if (foundIndex === -1) {
    steps.push({
      array: [...data],
      activeIndices: [],
      description: `Target ${target} not present after scanning ${data.length} elements.`,
      comparisons,
    });
  }
  return {
    foundIndex,
    foundValue: foundIndex >= 0 ? data[foundIndex] : null,
    comparisons,
    operations,
    steps,
    durationMs: performance.now() - t0,
  };
}

export function binarySearchTrace(sortedArr: number[], target: number): SearchTraceResult {
  const t0 = performance.now();
  const data = [...sortedArr];
  const steps: SearchStep[] = [];
  let comparisons = 0;
  let operations = 0;
  let lo = 0;
  let hi = data.length - 1;
  let foundIndex = -1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    comparisons++;
    operations++;
    if (data[mid] === target) {
      foundIndex = mid;
      steps.push({
        array: [...data],
        activeIndices: [mid],
        range: [lo, hi],
        pivotIndex: mid,
        foundIndex: mid,
        description: `Mid index ${mid} has value ${data[mid]} == ${target}. Found!`,
        comparisons,
      });
      break;
    }
    comparisons++;
    if (data[mid] < target) {
      steps.push({
        array: [...data],
        activeIndices: [mid],
        range: [lo, hi],
        pivotIndex: mid,
        description: `arr[${mid}] (${data[mid]}) < ${target}: discard left half, search [${mid + 1}..${hi}]`,
        comparisons,
      });
      lo = mid + 1;
    } else {
      steps.push({
        array: [...data],
        activeIndices: [mid],
        range: [lo, hi],
        pivotIndex: mid,
        description: `arr[${mid}] (${data[mid]}) > ${target}: discard right half, search [${lo}..${mid - 1}]`,
        comparisons,
      });
      hi = mid - 1;
    }
  }

  if (foundIndex === -1) {
    steps.push({
      array: [...data],
      activeIndices: [],
      description: `Search interval exhausted (lo=${lo} > hi=${hi}). ${target} not found.`,
      comparisons,
    });
  }

  return {
    foundIndex,
    foundValue: foundIndex >= 0 ? data[foundIndex] : null,
    comparisons,
    operations,
    steps,
    durationMs: performance.now() - t0,
  };
}

// Deterministic Median-of-Medians Selection + Median-Pivoted Search (works on unsorted data!)
export function medianSearchTrace(
  input: number[],
  target: number,
  findMedianOnly = false
): SearchTraceResult {
  const t0 = performance.now();
  const a = [...input];
  const steps: SearchStep[] = [];
  let comparisons = 0;
  let operations = 0;

  function insertionSortRange(lo: number, hi: number): void {
    for (let i = lo + 1; i <= hi; i++) {
      const key = a[i];
      let j = i - 1;
      while (j >= lo) {
        comparisons++;
        operations++;
        if (a[j] > key) {
          a[j + 1] = a[j];
          operations++;
          j--;
        } else {
          break;
        }
      }
      a[j + 1] = key;
    }
  }

  function partitionByValue(lo: number, hi: number, pivotVal: number): number {
    let pivotIdx = lo;
    for (let i = lo; i <= hi; i++) {
      comparisons++;
      if (a[i] === pivotVal) {
        pivotIdx = i;
        break;
      }
    }
    [a[pivotIdx], a[hi]] = [a[hi], a[pivotIdx]];
    let store = lo;
    for (let i = lo; i < hi; i++) {
      comparisons++;
      operations++;
      if (a[i] < pivotVal) {
        [a[store], a[i]] = [a[i], a[store]];
        store++;
      }
    }
    [a[store], a[hi]] = [a[hi], a[store]];
    return store;
  }

  function selectKth(lo: number, hi: number, k: number): number {
    if (hi - lo + 1 <= 5) {
      insertionSortRange(lo, hi);
      steps.push({
        array: [...a],
        activeIndices: [lo + k],
        range: [lo, hi],
        pivotIndex: lo + k,
        description: `Base group [${lo}..${hi}] sorted; k-th element at index ${lo + k} is ${a[lo + k]}.`,
        comparisons,
      });
      return a[lo + k];
    }

    const medians: number[] = [];
    for (let gStart = lo; gStart <= hi; gStart += 5) {
      const gEnd = Math.min(gStart + 4, hi);
      insertionSortRange(gStart, gEnd);
      medians.push(a[gStart + Math.floor((gEnd - gStart) / 2)]);
    }

    // Recursively select median of medians on small array
    const medRes = medianSearchTrace(medians, 0, true);
    comparisons += medRes.comparisons;
    operations += medRes.operations;
    const pivotVal = medRes.foundValue ?? medians[Math.floor(medians.length / 2)];

    const p = partitionByValue(lo, hi, pivotVal);
    steps.push({
      array: [...a],
      activeIndices: [p],
      range: [lo, hi],
      pivotIndex: p,
      description: `Median-of-Medians pivot ${pivotVal} partitioned [${lo}..${hi}] at index ${p}.`,
      comparisons,
    });

    const leftLen = p - lo;
    comparisons++;
    if (k === leftLen) return a[p];
    if (k < leftLen) return selectKth(lo, p - 1, k);
    return selectKth(p + 1, hi, k - leftLen - 1);
  }

  if (a.length === 0) {
    return { foundIndex: -1, foundValue: null, comparisons: 0, operations: 0, steps, durationMs: 0 };
  }

  if (findMedianOnly) {
    const k = Math.floor(a.length / 2);
    const medVal = selectKth(0, a.length - 1, k);
    const origIdx = input.indexOf(medVal);
    steps.push({
      array: [...a],
      activeIndices: [k],
      foundIndex: k,
      description: `Exact median found in O(n) worst-case time: ${medVal}`,
      comparisons,
    });
    return {
      foundIndex: origIdx,
      foundValue: medVal,
      comparisons,
      operations,
      steps,
      durationMs: performance.now() - t0,
    };
  }

  let lo = 0;
  let hi = a.length - 1;
  let foundIndex = -1;

  while (lo <= hi) {
    const len = hi - lo + 1;
    const midK = Math.floor(len / 2);
    const medVal = selectKth(lo, hi, midK);
    const pivotPos = lo + midK;
    comparisons++;
    operations++;
    if (medVal === target) {
      foundIndex = pivotPos;
      steps.push({
        array: [...a],
        activeIndices: [pivotPos],
        range: [lo, hi],
        pivotIndex: pivotPos,
        foundIndex: pivotPos,
        description: `Median value at partitioned index ${pivotPos} matches target ${target}!`,
        comparisons,
      });
      break;
    } else if (target < medVal) {
      steps.push({
        array: [...a],
        activeIndices: [pivotPos],
        range: [lo, hi],
        pivotIndex: pivotPos,
        description: `Target ${target} < median ${medVal}: recurse on left partition [${lo}..${pivotPos - 1}]`,
        comparisons,
      });
      hi = pivotPos - 1;
    } else {
      steps.push({
        array: [...a],
        activeIndices: [pivotPos],
        range: [lo, hi],
        pivotIndex: pivotPos,
        description: `Target ${target} > median ${medVal}: recurse on right partition [${pivotPos + 1}..${hi}]`,
        comparisons,
      });
      lo = pivotPos + 1;
    }
  }

  return {
    foundIndex: foundIndex >= 0 ? input.indexOf(target) : -1,
    foundValue: foundIndex >= 0 ? target : null,
    comparisons,
    operations,
    steps,
    durationMs: performance.now() - t0,
  };
}
