#pragma once

#include "linear_structures.hpp"
#include <chrono>
#include <cmath>
#include <cstddef>
#include <cstdint>

namespace dsa {

struct AlgorithmMetrics {
    long long comparisons = 0;
    long long swaps = 0;
    long long recursiveCalls = 0;
    long long operations = 0;
    size_t memoryBytes = 0;
    double durationMs = 0.0;
};

struct SearchResult {
    int index = -1;
    int foundValue = 0;
    AlgorithmMetrics metrics;
};

// 1. Linear Search
inline SearchResult linearSearch(const int* arr, int n, int target) {
    SearchResult res;
    auto t0 = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < n; ++i) {
        res.metrics.comparisons++;
        res.metrics.operations++;
        if (arr[i] == target) {
            res.index = i;
            res.foundValue = arr[i];
            break;
        }
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    res.metrics.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    res.metrics.memoryBytes = sizeof(int) * 2;
    return res;
}

// 2. Binary Search (requires sorted array)
inline SearchResult binarySearch(const int* arr, int n, int target) {
    SearchResult res;
    auto t0 = std::chrono::high_resolution_clock::now();
    int lo = 0, hi = n - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        res.metrics.comparisons++;
        res.metrics.operations++;
        if (arr[mid] == target) {
            res.index = mid;
            res.foundValue = arr[mid];
            break;
        }
        res.metrics.comparisons++;
        if (arr[mid] < target) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    res.metrics.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    res.metrics.memoryBytes = sizeof(int) * 3;
    return res;
}

// 3. Median-Based Search (Deterministic Median-of-Medians Selection + Median Partition Search)
namespace detail {
inline void insertionSortRange(int* a, int lo, int hi, AlgorithmMetrics& m) {
    for (int i = lo + 1; i <= hi; ++i) {
        int key = a[i];
        int j = i - 1;
        while (j >= lo) {
            m.comparisons++;
            m.operations++;
            if (a[j] > key) {
                a[j + 1] = a[j];
                m.swaps++;
                m.operations++;
                --j;
            } else {
                break;
            }
        }
        a[j + 1] = key;
    }
}

inline int partitionAroundPivotValue(int* a, int lo, int hi, int pivotVal, AlgorithmMetrics& m) {
    int pivotIdx = lo;
    for (int i = lo; i <= hi; ++i) {
        m.comparisons++;
        if (a[i] == pivotVal) {
            pivotIdx = i;
            break;
        }
    }
    int tmp = a[pivotIdx];
    a[pivotIdx] = a[hi];
    a[hi] = tmp;
    m.swaps++;

    int store = lo;
    for (int i = lo; i < hi; ++i) {
        m.comparisons++;
        m.operations++;
        if (a[i] < pivotVal) {
            int t = a[store];
            a[store] = a[i];
            a[i] = t;
            m.swaps++;
            ++store;
        }
    }
    int t = a[store];
    a[store] = a[hi];
    a[hi] = t;
    m.swaps++;
    return store;
}

inline int medianOfMediansSelect(int* a, int lo, int hi, int k, AlgorithmMetrics& m) {
    m.recursiveCalls++;
    if (hi - lo + 1 <= 5) {
        insertionSortRange(a, lo, hi, m);
        return a[lo + k];
    }
    int numGroups = (hi - lo + 5) / 5;
    int* medians = new int[numGroups];
    MemoryTracker::recordAlloc(1);
    for (int g = 0; g < numGroups; ++g) {
        int gLo = lo + g * 5;
        int gHi = gLo + 4;
        if (gHi > hi) gHi = hi;
        insertionSortRange(a, gLo, gHi, m);
        medians[g] = a[gLo + (gHi - gLo) / 2];
    }
    int medOfMed = medianOfMediansSelect(medians, 0, numGroups - 1, numGroups / 2, m);
    delete[] medians;
    MemoryTracker::recordFree(1);

    int p = partitionAroundPivotValue(a, lo, hi, medOfMed, m);
    int leftCount = p - lo;
    m.comparisons++;
    if (k == leftCount) return a[p];
    if (k < leftCount) return medianOfMediansSelect(a, lo, p - 1, k, m);
    return medianOfMediansSelect(a, p + 1, hi, k - leftCount - 1, m);
}
} // namespace detail

// Finds median value in unsorted array (or searches for target via median partitioning)
inline SearchResult medianSearch(const int* input, int n, int target, bool findMedianOnly = false) {
    SearchResult res;
    if (n <= 0) return res;
    int* work = new int[n];
    MemoryTracker::recordAlloc(1);
    for (int i = 0; i < n; ++i) work[i] = input[i];

    auto t0 = std::chrono::high_resolution_clock::now();
    if (findMedianOnly) {
        int medianVal = detail::medianOfMediansSelect(work, 0, n - 1, n / 2, res.metrics);
        res.foundValue = medianVal;
        for (int i = 0; i < n; ++i) {
            if (input[i] == medianVal) {
                res.index = i;
                break;
            }
        }
    } else {
        int lo = 0, hi = n - 1;
        while (lo <= hi) {
            int len = hi - lo + 1;
            int medVal = detail::medianOfMediansSelect(work, lo, hi, len / 2, res.metrics);
            int pivotPos = lo + len / 2;
            res.metrics.comparisons++;
            res.metrics.operations++;
            if (medVal == target) {
                res.foundValue = target;
                for (int i = 0; i < n; ++i) {
                    if (input[i] == target) {
                        res.index = i;
                        break;
                    }
                }
                break;
            } else if (target < medVal) {
                hi = pivotPos - 1;
            } else {
                lo = pivotPos + 1;
            }
        }
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    res.metrics.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    res.metrics.memoryBytes = static_cast<size_t>(n) * sizeof(int);

    delete[] work;
    MemoryTracker::recordFree(1);
    return res;
}

// ============================================================================
// 8 Manual Sorting Algorithms
// ============================================================================

inline void swapInt(int& a, int& b, AlgorithmMetrics& m) {
    int tmp = a;
    a = b;
    b = tmp;
    m.swaps++;
    m.operations += 3;
}

inline AlgorithmMetrics bubbleSort(int* arr, int n) {
    AlgorithmMetrics m;
    m.memoryBytes = sizeof(int) * 3;
    auto t0 = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < n - 1; ++i) {
        bool swapped = false;
        for (int j = 0; j < n - i - 1; ++j) {
            m.comparisons++;
            m.operations++;
            if (arr[j] > arr[j + 1]) {
                swapInt(arr[j], arr[j + 1], m);
                swapped = true;
            }
        }
        if (!swapped) break;
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    m.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    return m;
}

inline AlgorithmMetrics selectionSort(int* arr, int n) {
    AlgorithmMetrics m;
    m.memoryBytes = sizeof(int) * 3;
    auto t0 = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < n - 1; ++i) {
        int minIdx = i;
        for (int j = i + 1; j < n; ++j) {
            m.comparisons++;
            m.operations++;
            if (arr[j] < arr[minIdx]) {
                minIdx = j;
            }
        }
        if (minIdx != i) {
            swapInt(arr[i], arr[minIdx], m);
        }
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    m.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    return m;
}

inline AlgorithmMetrics insertionSort(int* arr, int n) {
    AlgorithmMetrics m;
    m.memoryBytes = sizeof(int) * 3;
    auto t0 = std::chrono::high_resolution_clock::now();
    for (int i = 1; i < n; ++i) {
        int key = arr[i];
        int j = i - 1;
        while (j >= 0) {
            m.comparisons++;
            m.operations++;
            if (arr[j] > key) {
                arr[j + 1] = arr[j];
                m.swaps++;
                m.operations++;
                --j;
            } else {
                break;
            }
        }
        arr[j + 1] = key;
        m.operations++;
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    m.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    return m;
}

namespace detail {
inline void merge(int* arr, int* temp, int lo, int mid, int hi, AlgorithmMetrics& m) {
    int i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) {
        m.comparisons++;
        m.operations++;
        if (arr[i] <= arr[j]) {
            temp[k++] = arr[i++];
        } else {
            temp[k++] = arr[j++];
            m.swaps++;
        }
    }
    while (i <= mid) {
        temp[k++] = arr[i++];
        m.operations++;
    }
    while (j <= hi) {
        temp[k++] = arr[j++];
        m.operations++;
    }
    for (int idx = lo; idx <= hi; ++idx) {
        arr[idx] = temp[idx];
        m.operations++;
    }
}

inline void mergeSortRec(int* arr, int* temp, int lo, int hi, AlgorithmMetrics& m) {
    m.recursiveCalls++;
    if (lo >= hi) return;
    int mid = lo + (hi - lo) / 2;
    mergeSortRec(arr, temp, lo, mid, m);
    mergeSortRec(arr, temp, mid + 1, hi, m);
    merge(arr, temp, lo, mid, hi, m);
}
} // namespace detail

inline AlgorithmMetrics mergeSort(int* arr, int n) {
    AlgorithmMetrics m;
    if (n <= 1) return m;
    int* temp = new int[n];
    MemoryTracker::recordAlloc(1);
    m.memoryBytes = static_cast<size_t>(n) * sizeof(int);
    auto t0 = std::chrono::high_resolution_clock::now();
    detail::mergeSortRec(arr, temp, 0, n - 1, m);
    auto t1 = std::chrono::high_resolution_clock::now();
    m.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    delete[] temp;
    MemoryTracker::recordFree(1);
    return m;
}

namespace detail {
inline int medianOfThree(int* arr, int lo, int hi, AlgorithmMetrics& m) {
    int mid = lo + (hi - lo) / 2;
    m.comparisons += 3;
    if (arr[lo] > arr[mid]) swapInt(arr[lo], arr[mid], m);
    if (arr[lo] > arr[hi]) swapInt(arr[lo], arr[hi], m);
    if (arr[mid] > arr[hi]) swapInt(arr[mid], arr[hi], m);
    swapInt(arr[mid], arr[hi], m);
    return arr[hi];
}

inline void quickSortRec(int* arr, int lo, int hi, AlgorithmMetrics& m) {
    m.recursiveCalls++;
    if (lo >= hi) return;
    int pivot = medianOfThree(arr, lo, hi, m);
    int i = lo - 1;
    for (int j = lo; j < hi; ++j) {
        m.comparisons++;
        m.operations++;
        if (arr[j] <= pivot) {
            ++i;
            if (i != j) swapInt(arr[i], arr[j], m);
        }
    }
    swapInt(arr[i + 1], arr[hi], m);
    int p = i + 1;
    quickSortRec(arr, lo, p - 1, m);
    quickSortRec(arr, p + 1, hi, m);
}
} // namespace detail

inline AlgorithmMetrics quickSort(int* arr, int n) {
    AlgorithmMetrics m;
    m.memoryBytes = static_cast<size_t>(std::log2(n > 1 ? n : 2)) * sizeof(int) * 4;
    auto t0 = std::chrono::high_resolution_clock::now();
    if (n > 1) detail::quickSortRec(arr, 0, n - 1, m);
    auto t1 = std::chrono::high_resolution_clock::now();
    m.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    return m;
}

inline AlgorithmMetrics countingSort(int* arr, int n) {
    AlgorithmMetrics m;
    if (n <= 1) return m;
    auto t0 = std::chrono::high_resolution_clock::now();
    int minV = arr[0], maxV = arr[0];
    for (int i = 1; i < n; ++i) {
        m.comparisons += 2;
        m.operations++;
        if (arr[i] < minV) minV = arr[i];
        if (arr[i] > maxV) maxV = arr[i];
    }
    int range = maxV - minV + 1;
    if (range > 2000000) range = 2000000; // safety guard
    int* count = new int[range]();
    int* output = new int[n];
    MemoryTracker::recordAlloc(2);
    m.memoryBytes = static_cast<size_t>(range + n) * sizeof(int);

    for (int i = 0; i < n; ++i) {
        int idx = arr[i] - minV;
        if (idx >= 0 && idx < range) count[idx]++;
        m.operations++;
    }
    for (int i = 1; i < range; ++i) {
        count[i] += count[i - 1];
        m.operations++;
    }
    for (int i = n - 1; i >= 0; --i) {
        int idx = arr[i] - minV;
        if (idx >= 0 && idx < range) {
            output[count[idx] - 1] = arr[i];
            count[idx]--;
        }
        m.swaps++;
        m.operations++;
    }
    for (int i = 0; i < n; ++i) {
        arr[i] = output[i];
        m.operations++;
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    m.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    delete[] count;
    delete[] output;
    MemoryTracker::recordFree(2);
    return m;
}

inline AlgorithmMetrics radixSort(int* arr, int n) {
    AlgorithmMetrics m;
    if (n <= 1) return m;
    auto t0 = std::chrono::high_resolution_clock::now();
    int minV = arr[0];
    for (int i = 1; i < n; ++i) {
        m.comparisons++;
        if (arr[i] < minV) minV = arr[i];
    }
    int shift = minV < 0 ? -minV : 0;
    int maxV = arr[0] + shift;
    for (int i = 0; i < n; ++i) {
        arr[i] += shift;
        if (arr[i] > maxV) maxV = arr[i];
        m.operations++;
    }

    int* output = new int[n];
    MemoryTracker::recordAlloc(1);
    m.memoryBytes = static_cast<size_t>(n + 10) * sizeof(int);

    for (long long exp = 1; maxV / exp > 0; exp *= 10) {
        int count[10] = {0};
        for (int i = 0; i < n; ++i) {
            count[(arr[i] / exp) % 10]++;
            m.operations++;
        }
        for (int i = 1; i < 10; ++i) {
            count[i] += count[i - 1];
            m.operations++;
        }
        for (int i = n - 1; i >= 0; --i) {
            int digit = (arr[i] / exp) % 10;
            output[count[digit] - 1] = arr[i];
            count[digit]--;
            m.swaps++;
            m.operations++;
        }
        for (int i = 0; i < n; ++i) {
            arr[i] = output[i];
            m.operations++;
        }
    }
    if (shift != 0) {
        for (int i = 0; i < n; ++i) arr[i] -= shift;
    }
    auto t1 = std::chrono::high_resolution_clock::now();
    m.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    delete[] output;
    MemoryTracker::recordFree(1);
    return m;
}

inline AlgorithmMetrics bucketSort(int* arr, int n) {
    AlgorithmMetrics m;
    if (n <= 1) return m;
    auto t0 = std::chrono::high_resolution_clock::now();
    int minV = arr[0], maxV = arr[0];
    for (int i = 1; i < n; ++i) {
        m.comparisons += 2;
        if (arr[i] < minV) minV = arr[i];
        if (arr[i] > maxV) maxV = arr[i];
    }
    if (minV == maxV) {
        auto t1 = std::chrono::high_resolution_clock::now();
        m.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
        return m;
    }

    int bucketCount = n < 64 ? n : static_cast<int>(std::sqrt(n)) + 1;
    DynamicArray<int>* buckets = new DynamicArray<int>[bucketCount];
    MemoryTracker::recordAlloc(1);

    double span = static_cast<double>(maxV - minV) + 1.0;
    for (int i = 0; i < n; ++i) {
        int bIdx = static_cast<int>((static_cast<double>(arr[i] - minV) / span) * bucketCount);
        if (bIdx < 0) bIdx = 0;
        if (bIdx >= bucketCount) bIdx = bucketCount - 1;
        buckets[bIdx].pushBack(arr[i]);
        m.operations++;
    }

    size_t mem = static_cast<size_t>(bucketCount) * sizeof(DynamicArray<int>);
    int outIdx = 0;
    for (int b = 0; b < bucketCount; ++b) {
        mem += buckets[b].memoryBytes();
        int bSize = static_cast<int>(buckets[b].size());
        // Insertion sort within each bucket
        for (int i = 1; i < bSize; ++i) {
            int key = buckets[b][i];
            int j = i - 1;
            while (j >= 0) {
                m.comparisons++;
                m.operations++;
                if (buckets[b][j] > key) {
                    buckets[b][j + 1] = buckets[b][j];
                    m.swaps++;
                    --j;
                } else {
                    break;
                }
            }
            buckets[b][j + 1] = key;
        }
        for (int i = 0; i < bSize; ++i) {
            arr[outIdx++] = buckets[b][i];
            m.operations++;
        }
    }
    m.memoryBytes = mem;
    auto t1 = std::chrono::high_resolution_clock::now();
    m.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    delete[] buckets;
    MemoryTracker::recordFree(1);
    return m;
}

} // namespace dsa
