#include "../include/linear_structures.hpp"
#include "../include/linked_lists.hpp"
#include "../include/searching_sorting.hpp"
#include "../include/hashing.hpp"
#include "../include/trees.hpp"
#include "../include/advanced_trees.hpp"
#include "../include/graphs.hpp"
#include "../include/strings.hpp"
#include "../include/backtracking.hpp"

#include <cassert>
#include <iostream>

using namespace dsa;

int main() {
    {
        // Linear structures
        DynamicArray<int> da;
        for (int i = 0; i < 20; ++i) da.pushBack(i * 2);
        assert(da.size() == 20 && da[5] == 10);
        da.insertAt(2, 999);
        assert(da[2] == 999 && da.size() == 21);
        da.removeAt(2);
        assert(da[2] == 4 && da.size() == 20);

        Stack<int> st;
        st.push(10); st.push(20); st.push(30);
        assert(st.pop() == 30 && st.peek() == 20);

        Queue<int> q;
        q.enqueue(1); q.enqueue(2); q.enqueue(3);
        assert(q.dequeue() == 1 && q.front() == 2);

        CircularQueue<int> cq(3);
        assert(cq.enqueue(10) && cq.enqueue(20) && cq.enqueue(30) && !cq.enqueue(40));
        assert(cq.dequeue() == 10 && cq.enqueue(40));

        // Linked lists & SparseMatrix
        SinglyLinkedList<int> sll;
        sll.pushBack(5); sll.pushFront(1); sll.pushBack(9);
        assert(sll.contains(5) && sll.removeFirst(5) && !sll.contains(5));

        DoublyLinkedList<int> dll;
        auto* n1 = dll.pushBack(10);
        auto* n2 = dll.pushBack(20);
        dll.removeNode(n1);
        assert(dll.size() == 1 && dll.head() == n2);

        CircularLinkedList<int> cll;
        cll.pushBack(1); cll.pushBack(2);
        assert(cll.rotateNext() == 1 && cll.rotateNext() == 2);

        SparseMatrix sm(10, 10);
        sm.set(2, 3, 42.5);
        sm.set(7, 8, -9.0);
        assert(sm.get(2, 3) == 42.5 && sm.get(0, 0) == 0.0 && sm.nonZeroCount() == 2);
        sm.remove(2, 3);
        assert(sm.get(2, 3) == 0.0 && sm.nonZeroCount() == 1);

        // Searching & Sorting
        int base[] = {42, 7, 19, 3, 88, 12, 5, 19, 0, 101};
        const int N = 10;
        auto runSortTest = [&](auto fn) {
            int copy[10];
            for (int i = 0; i < N; ++i) copy[i] = base[i];
            fn(copy, N);
            for (int i = 1; i < N; ++i) assert(copy[i - 1] <= copy[i]);
        };
        runSortTest(bubbleSort);
        runSortTest(selectionSort);
        runSortTest(insertionSort);
        runSortTest(mergeSort);
        runSortTest(quickSort);
        runSortTest(radixSort);
        runSortTest(bucketSort);
        runSortTest(countingSort);

        int sorted[] = {0, 3, 5, 7, 12, 19, 19, 42, 88, 101};
        assert(linearSearch(sorted, N, 42).index == 7);
        assert(binarySearch(sorted, N, 42).index == 7);
        assert(medianSearch(base, N, 42, false).foundValue == 42);
        auto medOnly = medianSearch(base, N, 0, true);
        assert(medOnly.foundValue == 19);

        // Hashing (all 4 collision strategies)
        CollisionStrategy strats[] = {
            CollisionStrategy::SeparateChaining,
            CollisionStrategy::LinearProbing,
            CollisionStrategy::QuadraticProbing,
            CollisionStrategy::DoubleHashing
        };
        for (auto strat : strats) {
            HashTable<int> ht(strat, 7);
            for (int i = 0; i < 30; ++i) ht.insert("key_" + std::to_string(i), i * 10);
            int val = 0;
            assert(ht.find("key_17", val) && val == 170);
            assert(ht.remove("key_17") && !ht.find("key_17", val));
        }

        // Trees
        BinarySearchTree<int, int> bst;
        AVLTree<int, int> avl;
        RedBlackTree<int, int> rbt;
        BTree bt(3);
        ThreadedBinaryTree tbt;
        for (int k : {30, 10, 50, 5, 20, 40, 60, 15, 25}) {
            bst.insert(k, k * 2);
            avl.insert(k, k * 2);
            rbt.insert(k, k * 2);
            bt.insert(k);
            tbt.insert(k);
        }
        int out = 0;
        assert(bst.search(25, out) && out == 50);
        assert(avl.search(25, out) && out == 50 && avl.height() <= 4);
        assert(rbt.search(25, out) && out == 50);
        assert(bt.search(25));
        auto inOrder = tbt.inorder();
        assert(inOrder.size() == 9 && inOrder[0] == 5 && inOrder[8] == 60);

        BinaryHeap<int> pq(false);
        pq.push(10); pq.push(99); pq.push(42);
        assert(pq.pop() == 99 && pq.pop() == 42);

        // Advanced Trees
        int segArr[] = {100, 45, 70, 20, 90};
        SegmentTree stree(segArr, 5);
        assert(stree.queryMin(0, 4) == 20 && stree.queryMax(0, 4) == 100);
        stree.update(3, 120);
        assert(stree.queryMin(0, 4) == 45 && stree.queryMax(0, 4) == 120);

        IntervalTree itree;
        itree.insert(10, 20, 1);
        itree.insert(25, 35, 2);
        auto ov = itree.queryOverlapping(18, 26);
        assert(ov.size() == 2);

        KDTree kd;
        kd.insert({1.0, 2.0, 1});
        kd.insert({8.0, 9.0, 2});
        kd.insert({4.0, 5.0, 3});
        KDTree::Point nearPt;
        assert(kd.nearest(4.1, 4.9, nearPt) && nearPt.id == 3);

        QuadTree qt({0, 0, 100, 100}, 2);
        qt.insert({10, 10, 1});
        qt.insert({12, 12, 2});
        qt.insert({80, 80, 3});
        DynamicArray<QuadTree::Entity> found;
        qt.queryRadius(11, 11, 5, found);
        assert(found.size() == 2);

        // Graphs
        Graph g(5, false);
        g.addEdge(0, 1, 2);
        g.addEdge(1, 2, 3);
        g.addEdge(0, 3, 6);
        g.addEdge(3, 4, 1);
        g.addEdge(2, 4, 5);
        assert(g.bfs(0).size() == 5 && g.dfs(0).size() == 5);
        auto dist = g.dijkstra(0);
        assert(dist[2] == 5.0);
        DynamicArray<GraphEdge> mst;
        double mstW = g.kruskalMST(mst);
        assert(mst.size() == 4 && mstW == 11.0);

        // Strings
        Trie trie;
        trie.insert("sniper"); trie.insert("splash"); trie.insert("slow");
        assert(trie.search("sniper") && !trie.search("snip"));
        assert(trie.autocomplete("sp").size() == 1);

        SuffixArray sa("algorithmic battlefield");
        assert(sa.searchPattern("battle") == 12);
        auto rk = StringHasher::rabinKarp("ababcabcab", "abc");
        assert(rk.size() == 2 && rk[0] == 2 && rk[1] == 5);

        // Backtracking
        DynamicArray<DynamicArray<int>> maze;
        int mData[4][4] = {
            {0, 1, 0, 0},
            {0, 0, 0, 1},
            {1, 0, 1, 0},
            {0, 0, 0, 0}
        };
        for (int r = 0; r < 4; ++r) {
            DynamicArray<int> row;
            for (int c = 0; c < 4; ++c) row.pushBack(mData[r][c]);
            maze.pushBack(std::move(row));
        }
        DynamicArray<DynamicArray<int>> mazeSol;
        assert(RatInMaze::solve(maze, mazeSol) && mazeSol[3][3] == 1);

        DynamicArray<int> qSol;
        assert(NQueens::countSolutions(4, qSol) == 2 && qSol.size() == 4);
    }

    // Verify all heap allocations freed by destructors
    assert(MemoryTracker::activeAllocations == 0);
    std::cout << "All C++17 DSA unit tests passed! Total allocs: "
              << MemoryTracker::totalAllocations
              << ", total frees: " << MemoryTracker::totalDeallocations
              << ", active leaks: " << MemoryTracker::activeAllocations << "\n";
    return 0;
}
