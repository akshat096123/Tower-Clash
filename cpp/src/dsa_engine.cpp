#include "../include/linear_structures.hpp"
#include "../include/linked_lists.hpp"
#include "../include/searching_sorting.hpp"
#include "../include/hashing.hpp"
#include "../include/trees.hpp"
#include "../include/advanced_trees.hpp"
#include "../include/graphs.hpp"
#include "../include/strings.hpp"
#include "../include/backtracking.hpp"

#include <chrono>
#include <cstdint>
#include <iostream>
#include <string>

using namespace dsa;

static uint32_t nextRand(uint32_t& state) {
    state = state * 1664525U + 1013904223U;
    return state;
}

static void generateDataset(int* arr, int n, const std::string& pattern, uint32_t seed) {
    uint32_t state = seed;
    if (pattern == "sorted") {
        for (int i = 0; i < n; ++i) arr[i] = i + 1;
    } else if (pattern == "reversed") {
        for (int i = 0; i < n; ++i) arr[i] = n - i;
    } else {
        for (int i = 0; i < n; ++i) {
            arr[i] = static_cast<int>(nextRand(state) % static_cast<uint32_t>(n * 10 + 100));
        }
    }
}

static void printMetricsJson(const std::string& algo, int n, const AlgorithmMetrics& m) {
    std::cout << "{"
              << "\"algorithm\":\"" << algo << "\","
              << "\"inputSize\":" << n << ","
              << "\"durationMs\":" << m.durationMs << ","
              << "\"comparisons\":" << m.comparisons << ","
              << "\"swaps\":" << m.swaps << ","
              << "\"recursiveCalls\":" << m.recursiveCalls << ","
              << "\"operations\":" << m.operations << ","
              << "\"memoryBytes\":" << m.memoryBytes
              << "}";
}

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "Usage: dsa_engine <benchmark_sort|benchmark_search|benchmark_trees|benchmark_graphs> [args...]\n";
        return 1;
    }

    std::string mode = argv[1];
    if (mode == "benchmark_sort") {
        int n = (argc >= 3) ? std::stoi(argv[2]) : 1000;
        std::string pattern = (argc >= 4) ? argv[3] : "random";
        int trials = (argc >= 5) ? std::stoi(argv[4]) : 3;
        if (trials < 1) trials = 1;
        if (trials > 10) trials = 10;

        const char* algos[] = {"bubble", "selection", "insertion", "merge", "quick", "radix", "bucket", "counting"};
        std::cout << "{\"engine\":\"C++17\",\"category\":\"sorting\",\"pattern\":\"" << pattern << "\",\"results\":[";
        bool first = true;
        for (int a = 0; a < 8; ++a) {
            std::string name = algos[a];
            if (n > 5000 && (name == "bubble" || name == "selection" || name == "insertion")) {
                // Still run up to 10000 for authentic measurement, cap only if > 25000
                if (n > 25000) continue;
            }
            AlgorithmMetrics agg;
            for (int t = 0; t < trials; ++t) {
                int* arr = new int[n];
                generateDataset(arr, n, pattern, 42U + static_cast<uint32_t>(t * 17));
                AlgorithmMetrics m;
                if (name == "bubble") m = bubbleSort(arr, n);
                else if (name == "selection") m = selectionSort(arr, n);
                else if (name == "insertion") m = insertionSort(arr, n);
                else if (name == "merge") m = mergeSort(arr, n);
                else if (name == "quick") m = quickSort(arr, n);
                else if (name == "radix") m = radixSort(arr, n);
                else if (name == "bucket") m = bucketSort(arr, n);
                else m = countingSort(arr, n);

                agg.comparisons += m.comparisons;
                agg.swaps += m.swaps;
                agg.recursiveCalls += m.recursiveCalls;
                agg.operations += m.operations;
                agg.memoryBytes = m.memoryBytes;
                agg.durationMs += m.durationMs;
                delete[] arr;
            }
            agg.comparisons /= trials;
            agg.swaps /= trials;
            agg.recursiveCalls /= trials;
            agg.operations /= trials;
            agg.durationMs /= trials;

            if (!first) std::cout << ",";
            first = false;
            printMetricsJson(name, n, agg);
        }
        std::cout << "]}\n";
        return 0;
    }

    if (mode == "benchmark_search") {
        int n = (argc >= 3) ? std::stoi(argv[2]) : 1000;
        std::string pattern = (argc >= 4) ? argv[3] : "average";
        int* sortedArr = new int[n];
        for (int i = 0; i < n; ++i) sortedArr[i] = i * 2 + 1;
        int target = (pattern == "best") ? sortedArr[n / 2]
                   : (pattern == "worst") ? -999
                   : sortedArr[(n * 3) / 4];

        auto rLin = linearSearch(sortedArr, n, target);
        auto rBin = binarySearch(sortedArr, n, target);
        auto rMed = medianSearch(sortedArr, n, target, false);

        std::cout << "{\"engine\":\"C++17\",\"category\":\"searching\",\"pattern\":\"" << pattern << "\",\"results\":[";
        printMetricsJson("linear", n, rLin.metrics);
        std::cout << ",";
        printMetricsJson("binary", n, rBin.metrics);
        std::cout << ",";
        printMetricsJson("median", n, rMed.metrics);
        std::cout << "]}\n";
        delete[] sortedArr;
        return 0;
    }

    if (mode == "benchmark_trees") {
        int n = (argc >= 3) ? std::stoi(argv[2]) : 1000;
        std::string pattern = (argc >= 4) ? argv[3] : "random";
        int* keys = new int[n];
        generateDataset(keys, n, pattern, 1337U);

        // BST
        AlgorithmMetrics bstM;
        {
            BinarySearchTree<int, int> bst;
            auto t0 = std::chrono::high_resolution_clock::now();
            for (int i = 0; i < n; ++i) bstM.operations += bst.insert(keys[i], i);
            int dummy = 0;
            for (int i = 0; i < n; ++i) {
                long long sOps = 0;
                bst.search(keys[i], dummy, &sOps);
                bstM.operations += sOps;
            }
            auto t1 = std::chrono::high_resolution_clock::now();
            bstM.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
            bstM.memoryBytes = bst.memoryBytes();
            bstM.comparisons = bstM.operations;
        }

        // AVL
        AlgorithmMetrics avlM;
        {
            AVLTree<int, int> avl;
            auto t0 = std::chrono::high_resolution_clock::now();
            for (int i = 0; i < n; ++i) avlM.operations += avl.insert(keys[i], i);
            int dummy = 0;
            for (int i = 0; i < n; ++i) {
                long long sOps = 0;
                avl.search(keys[i], dummy, &sOps);
                avlM.operations += sOps;
            }
            auto t1 = std::chrono::high_resolution_clock::now();
            avlM.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
            avlM.memoryBytes = avl.memoryBytes();
            avlM.comparisons = avlM.operations;
        }

        // Red-Black Tree
        AlgorithmMetrics rbM;
        {
            RedBlackTree<int, int> rbt;
            auto t0 = std::chrono::high_resolution_clock::now();
            for (int i = 0; i < n; ++i) rbM.operations += rbt.insert(keys[i], i);
            int dummy = 0;
            for (int i = 0; i < n; ++i) {
                long long sOps = 0;
                rbt.search(keys[i], dummy, &sOps);
                rbM.operations += sOps;
            }
            auto t1 = std::chrono::high_resolution_clock::now();
            rbM.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
            rbM.memoryBytes = rbt.memoryBytes();
            rbM.comparisons = rbM.operations;
        }

        // B-Tree
        AlgorithmMetrics btM;
        {
            BTree bt(4);
            auto t0 = std::chrono::high_resolution_clock::now();
            for (int i = 0; i < n; ++i) btM.operations += bt.insert(keys[i]);
            for (int i = 0; i < n; ++i) {
                long long sOps = 0;
                bt.search(keys[i], &sOps);
                btM.operations += sOps;
            }
            auto t1 = std::chrono::high_resolution_clock::now();
            btM.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
            btM.memoryBytes = static_cast<size_t>(n) * sizeof(int) * 2;
            btM.comparisons = btM.operations;
        }

        std::cout << "{\"engine\":\"C++17\",\"category\":\"trees\",\"pattern\":\"" << pattern << "\",\"results\":[";
        printMetricsJson("bst", n, bstM);
        std::cout << ",";
        printMetricsJson("avl", n, avlM);
        std::cout << ",";
        printMetricsJson("redblack", n, rbM);
        std::cout << ",";
        printMetricsJson("btree", n, btM);
        std::cout << "]}\n";
        delete[] keys;
        return 0;
    }

    if (mode == "benchmark_graphs") {
        int v = (argc >= 3) ? std::stoi(argv[2]) : 100;
        if (v < 5) v = 5;
        if (v > 600) v = 600;
        Graph g(v, false);
        uint32_t seed = 99U;
        for (int i = 0; i < v - 1; ++i) {
            g.addEdge(i, i + 1, 1.0 + (nextRand(seed) % 20));
        }
        for (int i = 0; i < v * 2; ++i) {
            int a = static_cast<int>(nextRand(seed) % v);
            int b = static_cast<int>(nextRand(seed) % v);
            if (a != b) g.addEdge(a, b, 1.0 + (nextRand(seed) % 25));
        }

        AlgorithmMetrics bfsM, dfsM, dijkM, bfM;
        {
            auto t0 = std::chrono::high_resolution_clock::now();
            auto res = g.bfs(0);
            auto t1 = std::chrono::high_resolution_clock::now();
            bfsM.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
            bfsM.operations = static_cast<long long>(res.size()) * 3;
            bfsM.memoryBytes = static_cast<size_t>(v) * sizeof(int) * 2;
        }
        {
            auto t0 = std::chrono::high_resolution_clock::now();
            auto res = g.dfs(0);
            auto t1 = std::chrono::high_resolution_clock::now();
            dfsM.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
            dfsM.operations = static_cast<long long>(res.size()) * 3;
            dfsM.memoryBytes = static_cast<size_t>(v) * sizeof(int) * 2;
        }
        {
            auto t0 = std::chrono::high_resolution_clock::now();
            auto dist = g.dijkstra(0);
            auto t1 = std::chrono::high_resolution_clock::now();
            dijkM.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
            dijkM.operations = static_cast<long long>(v) * 6;
            dijkM.memoryBytes = dist.memoryBytes();
        }
        {
            bool neg = false;
            auto t0 = std::chrono::high_resolution_clock::now();
            auto dist = g.bellmanFord(0, neg);
            auto t1 = std::chrono::high_resolution_clock::now();
            bfM.durationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
            bfM.operations = static_cast<long long>(v) * static_cast<long long>(v);
            bfM.memoryBytes = dist.memoryBytes();
        }

        std::cout << "{\"engine\":\"C++17\",\"category\":\"graphs\",\"pattern\":\"sparse\",\"results\":[";
        printMetricsJson("bfs", v, bfsM);
        std::cout << ",";
        printMetricsJson("dfs", v, dfsM);
        std::cout << ",";
        printMetricsJson("dijkstra", v, dijkM);
        std::cout << ",";
        printMetricsJson("bellman_ford", v, bfM);
        std::cout << "]}\n";
        return 0;
    }

    return 1;
}
