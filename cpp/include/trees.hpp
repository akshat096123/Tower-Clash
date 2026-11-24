#pragma once

#include "linear_structures.hpp"
#include <algorithm>
#include <cstddef>
#include <stdexcept>

namespace dsa {

// 1. Binary Search Tree
template <typename K, typename V>
class BinarySearchTree {
public:
    struct Node {
        K key;
        V value;
        Node* left;
        Node* right;
        Node(const K& k, const V& v) : key(k), value(v), left(nullptr), right(nullptr) {}
    };

private:
    Node* root_ = nullptr;
    size_t size_ = 0;

    void destroy(Node* n) {
        if (!n) return;
        destroy(n->left);
        destroy(n->right);
        delete n;
        MemoryTracker::recordFree(1);
    }

    Node* insertRec(Node* n, const K& k, const V& v, long long& ops) {
        ops++;
        if (!n) {
            ++size_;
            MemoryTracker::recordAlloc(1);
            return new Node(k, v);
        }
        if (k < n->key) n->left = insertRec(n->left, k, v, ops);
        else if (k > n->key) n->right = insertRec(n->right, k, v, ops);
        else n->value = v;
        return n;
    }

    Node* minNode(Node* n) const {
        while (n && n->left) n = n->left;
        return n;
    }

    Node* removeRec(Node* n, const K& k, bool& removed, long long& ops) {
        ops++;
        if (!n) return nullptr;
        if (k < n->key) n->left = removeRec(n->left, k, removed, ops);
        else if (k > n->key) n->right = removeRec(n->right, k, removed, ops);
        else {
            removed = true;
            if (!n->left) {
                Node* r = n->right;
                delete n;
                MemoryTracker::recordFree(1);
                --size_;
                return r;
            }
            if (!n->right) {
                Node* l = n->left;
                delete n;
                MemoryTracker::recordFree(1);
                --size_;
                return l;
            }
            Node* succ = minNode(n->right);
            n->key = succ->key;
            n->value = succ->value;
            bool dummy = false;
            n->right = removeRec(n->right, succ->key, dummy, ops);
        }
        return n;
    }

public:
    ~BinarySearchTree() { destroy(root_); }

    long long insert(const K& k, const V& v) {
        long long ops = 0;
        root_ = insertRec(root_, k, v, ops);
        return ops;
    }

    bool search(const K& k, V& out, long long* opsOut = nullptr) const {
        Node* curr = root_;
        long long ops = 0;
        while (curr) {
            ops++;
            if (k == curr->key) {
                out = curr->value;
                if (opsOut) *opsOut = ops;
                return true;
            }
            curr = (k < curr->key) ? curr->left : curr->right;
        }
        if (opsOut) *opsOut = ops;
        return false;
    }

    bool remove(const K& k, long long* opsOut = nullptr) {
        bool removed = false;
        long long ops = 0;
        root_ = removeRec(root_, k, removed, ops);
        if (opsOut) *opsOut = ops;
        return removed;
    }

    size_t size() const { return size_; }
    size_t memoryBytes() const { return sizeof(*this) + size_ * sizeof(Node); }
};

// 2. Threaded Binary Tree (Right-threaded inorder traversal)
class ThreadedBinaryTree {
public:
    struct Node {
        int key;
        Node* left;
        Node* right;
        bool rightThread;
        explicit Node(int k) : key(k), left(nullptr), right(nullptr), rightThread(false) {}
    };

private:
    Node* root_ = nullptr;
    size_t size_ = 0;

public:
    ~ThreadedBinaryTree() {
        // Free via threaded inorder or stack
        Node* curr = root_;
        while (curr && curr->left) curr = curr->left;
        while (curr) {
            Node* nxt = nullptr;
            if (curr->rightThread) {
                nxt = curr->right;
            } else {
                nxt = curr->right;
                while (nxt && nxt->left) nxt = nxt->left;
            }
            delete curr;
            MemoryTracker::recordFree(1);
            curr = nxt;
        }
    }

    void insert(int key) {
        Node* parent = nullptr;
        Node* curr = root_;
        while (curr != nullptr) {
            if (key == curr->key) return;
            parent = curr;
            if (key < curr->key) {
                curr = curr->left;
            } else {
                if (!curr->rightThread) curr = curr->right;
                else break;
            }
        }
        Node* n = new Node(key);
        MemoryTracker::recordAlloc(1);
        ++size_;
        if (!parent) {
            root_ = n;
        } else if (key < parent->key) {
            n->right = parent;
            n->rightThread = true;
            parent->left = n;
        } else {
            n->right = parent->right;
            n->rightThread = parent->rightThread;
            parent->right = n;
            parent->rightThread = false;
        }
    }

    DynamicArray<int> inorder() const {
        DynamicArray<int> out;
        Node* curr = root_;
        while (curr && curr->left) curr = curr->left;
        while (curr) {
            out.pushBack(curr->key);
            if (curr->rightThread) {
                curr = curr->right;
            } else {
                curr = curr->right;
                while (curr && curr->left) curr = curr->left;
            }
        }
        return out;
    }

    size_t size() const { return size_; }
};

// 3. AVL Tree
template <typename K, typename V>
class AVLTree {
public:
    struct Node {
        K key;
        V value;
        int height;
        Node* left;
        Node* right;
        Node(const K& k, const V& v) : key(k), value(v), height(1), left(nullptr), right(nullptr) {}
    };

private:
    Node* root_ = nullptr;
    size_t size_ = 0;

    int h(Node* n) const { return n ? n->height : 0; }
    int bf(Node* n) const { return n ? h(n->left) - h(n->right) : 0; }
    void update(Node* n) {
        if (n) n->height = 1 + std::max(h(n->left), h(n->right));
    }

    Node* rotateRight(Node* y) {
        Node* x = y->left;
        Node* t2 = x->right;
        x->right = y;
        y->left = t2;
        update(y);
        update(x);
        return x;
    }

    Node* rotateLeft(Node* x) {
        Node* y = x->right;
        Node* t2 = y->left;
        y->left = x;
        x->right = t2;
        update(x);
        update(y);
        return y;
    }

    Node* balance(Node* n) {
        update(n);
        int b = bf(n);
        if (b > 1) {
            if (bf(n->left) < 0) n->left = rotateLeft(n->left);
            return rotateRight(n);
        }
        if (b < -1) {
            if (bf(n->right) > 0) n->right = rotateRight(n->right);
            return rotateLeft(n);
        }
        return n;
    }

    Node* insertRec(Node* n, const K& k, const V& v, long long& ops) {
        ops++;
        if (!n) {
            ++size_;
            MemoryTracker::recordAlloc(1);
            return new Node(k, v);
        }
        if (k < n->key) n->left = insertRec(n->left, k, v, ops);
        else if (k > n->key) n->right = insertRec(n->right, k, v, ops);
        else {
            n->value = v;
            return n;
        }
        return balance(n);
    }

    Node* minNode(Node* n) const {
        while (n && n->left) n = n->left;
        return n;
    }

    Node* removeRec(Node* n, const K& k, bool& removed, long long& ops) {
        ops++;
        if (!n) return nullptr;
        if (k < n->key) n->left = removeRec(n->left, k, removed, ops);
        else if (k > n->key) n->right = removeRec(n->right, k, removed, ops);
        else {
            removed = true;
            if (!n->left || !n->right) {
                Node* child = n->left ? n->left : n->right;
                delete n;
                MemoryTracker::recordFree(1);
                --size_;
                return child;
            }
            Node* succ = minNode(n->right);
            n->key = succ->key;
            n->value = succ->value;
            bool dummy = false;
            n->right = removeRec(n->right, succ->key, dummy, ops);
        }
        return balance(n);
    }

    void destroy(Node* n) {
        if (!n) return;
        destroy(n->left);
        destroy(n->right);
        delete n;
        MemoryTracker::recordFree(1);
    }

public:
    ~AVLTree() { destroy(root_); }

    long long insert(const K& k, const V& v) {
        long long ops = 0;
        root_ = insertRec(root_, k, v, ops);
        return ops;
    }

    bool search(const K& k, V& out, long long* opsOut = nullptr) const {
        Node* curr = root_;
        long long ops = 0;
        while (curr) {
            ops++;
            if (k == curr->key) {
                out = curr->value;
                if (opsOut) *opsOut = ops;
                return true;
            }
            curr = (k < curr->key) ? curr->left : curr->right;
        }
        if (opsOut) *opsOut = ops;
        return false;
    }

    bool remove(const K& k, long long* opsOut = nullptr) {
        bool removed = false;
        long long ops = 0;
        root_ = removeRec(root_, k, removed, ops);
        if (opsOut) *opsOut = ops;
        return removed;
    }

    int height() const { return h(root_); }
    size_t size() const { return size_; }
    size_t memoryBytes() const { return sizeof(*this) + size_ * sizeof(Node); }
};

// 4. Red-Black Tree
template <typename K, typename V>
class RedBlackTree {
public:
    enum class Color { Red, Black };
    struct Node {
        K key;
        V value;
        Color color;
        Node* left;
        Node* right;
        Node* parent;
        Node(const K& k, const V& v)
            : key(k), value(v), color(Color::Red), left(nullptr), right(nullptr), parent(nullptr) {}
    };

private:
    Node* root_ = nullptr;
    size_t size_ = 0;

    void rotateLeft(Node* x) {
        Node* y = x->right;
        x->right = y->left;
        if (y->left) y->left->parent = x;
        y->parent = x->parent;
        if (!x->parent) root_ = y;
        else if (x == x->parent->left) x->parent->left = y;
        else x->parent->right = y;
        y->left = x;
        x->parent = y;
    }

    void rotateRight(Node* y) {
        Node* x = y->left;
        y->left = x->right;
        if (x->right) x->right->parent = y;
        x->parent = y->parent;
        if (!y->parent) root_ = x;
        else if (y == y->parent->left) y->parent->left = x;
        else y->parent->right = x;
        x->right = y;
        y->parent = x;
    }

    void fixInsert(Node* z, long long& ops) {
        while (z->parent && z->parent->color == Color::Red) {
            ops++;
            Node* gp = z->parent->parent;
            if (!gp) break;
            if (z->parent == gp->left) {
                Node* uncle = gp->right;
                if (uncle && uncle->color == Color::Red) {
                    z->parent->color = Color::Black;
                    uncle->color = Color::Black;
                    gp->color = Color::Red;
                    z = gp;
                } else {
                    if (z == z->parent->right) {
                        z = z->parent;
                        rotateLeft(z);
                    }
                    z->parent->color = Color::Black;
                    gp->color = Color::Red;
                    rotateRight(gp);
                }
            } else {
                Node* uncle = gp->left;
                if (uncle && uncle->color == Color::Red) {
                    z->parent->color = Color::Black;
                    uncle->color = Color::Black;
                    gp->color = Color::Red;
                    z = gp;
                } else {
                    if (z == z->parent->left) {
                        z = z->parent;
                        rotateRight(z);
                    }
                    z->parent->color = Color::Black;
                    gp->color = Color::Red;
                    rotateLeft(gp);
                }
            }
        }
        if (root_) root_->color = Color::Black;
    }

    void destroy(Node* n) {
        if (!n) return;
        destroy(n->left);
        destroy(n->right);
        delete n;
        MemoryTracker::recordFree(1);
    }

public:
    ~RedBlackTree() { destroy(root_); }

    long long insert(const K& k, const V& v) {
        long long ops = 0;
        Node* z = new Node(k, v);
        MemoryTracker::recordAlloc(1);
        Node* y = nullptr;
        Node* x = root_;
        while (x) {
            ops++;
            y = x;
            if (k < x->key) x = x->left;
            else if (k > x->key) x = x->right;
            else {
                x->value = v;
                delete z;
                MemoryTracker::recordFree(1);
                return ops;
            }
        }
        z->parent = y;
        if (!y) root_ = z;
        else if (k < y->key) y->left = z;
        else y->right = z;
        ++size_;
        fixInsert(z, ops);
        return ops;
    }

    bool search(const K& k, V& out, long long* opsOut = nullptr) const {
        Node* curr = root_;
        long long ops = 0;
        while (curr) {
            ops++;
            if (k == curr->key) {
                out = curr->value;
                if (opsOut) *opsOut = ops;
                return true;
            }
            curr = (k < curr->key) ? curr->left : curr->right;
        }
        if (opsOut) *opsOut = ops;
        return false;
    }

    size_t size() const { return size_; }
    size_t memoryBytes() const { return sizeof(*this) + size_ * sizeof(Node); }
};

// 5. B-Tree (order t)
class BTree {
public:
    struct Node {
        bool leaf;
        DynamicArray<int> keys;
        DynamicArray<Node*> children;
        explicit Node(bool isLeaf) : leaf(isLeaf) {}
    };

private:
    Node* root_ = nullptr;
    int t_;
    size_t size_ = 0;

    void splitChild(Node* x, int i) {
        Node* y = x->children[i];
        Node* z = new Node(y->leaf);
        MemoryTracker::recordAlloc(1);

        for (int j = 0; j < t_ - 1; ++j) {
            z->keys.pushBack(y->keys[j + t_]);
        }
        if (!y->leaf) {
            for (int j = 0; j < t_; ++j) {
                z->children.pushBack(y->children[j + t_]);
            }
            for (int j = 0; j < t_; ++j) y->children.popBack();
        }
        int midKey = y->keys[t_ - 1];
        for (int j = 0; j < t_; ++j) y->keys.popBack();

        x->children.insertAt(i + 1, z);
        x->keys.insertAt(i, midKey);
    }

    void insertNonFull(Node* x, int k, long long& ops) {
        ops++;
        int i = static_cast<int>(x->keys.size()) - 1;
        if (x->leaf) {
            while (i >= 0 && k < x->keys[i]) {
                --i;
                ops++;
            }
            x->keys.insertAt(i + 1, k);
        } else {
            while (i >= 0 && k < x->keys[i]) {
                --i;
                ops++;
            }
            ++i;
            if (static_cast<int>(x->children[i]->keys.size()) == 2 * t_ - 1) {
                splitChild(x, i);
                if (k > x->keys[i]) ++i;
            }
            insertNonFull(x->children[i], k, ops);
        }
    }

    void destroy(Node* n) {
        if (!n) return;
        for (size_t i = 0; i < n->children.size(); ++i) {
            destroy(n->children[i]);
        }
        delete n;
        MemoryTracker::recordFree(1);
    }

public:
    explicit BTree(int t = 3) : t_(t < 2 ? 2 : t) {}
    ~BTree() { destroy(root_); }

    long long insert(int k) {
        long long ops = 0;
        if (!root_) {
            root_ = new Node(true);
            MemoryTracker::recordAlloc(1);
            root_->keys.pushBack(k);
            ++size_;
            return 1;
        }
        if (static_cast<int>(root_->keys.size()) == 2 * t_ - 1) {
            Node* s = new Node(false);
            MemoryTracker::recordAlloc(1);
            s->children.pushBack(root_);
            splitChild(s, 0);
            int i = (k > s->keys[0]) ? 1 : 0;
            insertNonFull(s->children[i], k, ops);
            root_ = s;
        } else {
            insertNonFull(root_, k, ops);
        }
        ++size_;
        return ops;
    }

    bool search(int k, long long* opsOut = nullptr) const {
        Node* curr = root_;
        long long ops = 0;
        while (curr) {
            int i = 0;
            while (i < static_cast<int>(curr->keys.size()) && k > curr->keys[i]) {
                ++i;
                ops++;
            }
            ops++;
            if (i < static_cast<int>(curr->keys.size()) && k == curr->keys[i]) {
                if (opsOut) *opsOut = ops;
                return true;
            }
            if (curr->leaf) break;
            curr = curr->children[i];
        }
        if (opsOut) *opsOut = ops;
        return false;
    }

    size_t size() const { return size_; }
};

// 6. Binary Heap & Priority Queue
template <typename T>
class BinaryHeap {
private:
    DynamicArray<T> heap_;
    bool isMin_;

    bool higherPriority(const T& a, const T& b) const {
        return isMin_ ? (a < b) : (a > b);
    }

    void siftUp(size_t idx) {
        while (idx > 0) {
            size_t parent = (idx - 1) / 2;
            if (higherPriority(heap_[idx], heap_[parent])) {
                std::swap(heap_[idx], heap_[parent]);
                idx = parent;
            } else {
                break;
            }
        }
    }

    void siftDown(size_t idx) {
        size_t n = heap_.size();
        while (true) {
            size_t best = idx;
            size_t left = 2 * idx + 1;
            size_t right = 2 * idx + 2;
            if (left < n && higherPriority(heap_[left], heap_[best])) best = left;
            if (right < n && higherPriority(heap_[right], heap_[best])) best = right;
            if (best == idx) break;
            std::swap(heap_[idx], heap_[best]);
            idx = best;
        }
    }

public:
    explicit BinaryHeap(bool isMin = true) : isMin_(isMin) {}

    void push(const T& val) {
        heap_.pushBack(val);
        siftUp(heap_.size() - 1);
    }

    T pop() {
        if (heap_.empty()) throw std::out_of_range("BinaryHeap empty");
        T top = heap_[0];
        heap_[0] = heap_[heap_.size() - 1];
        heap_.popBack();
        if (!heap_.empty()) siftDown(0);
        return top;
    }

    const T& peek() const {
        if (heap_.empty()) throw std::out_of_range("BinaryHeap empty");
        return heap_[0];
    }

    bool empty() const { return heap_.empty(); }
    size_t size() const { return heap_.size(); }
    size_t memoryBytes() const { return heap_.memoryBytes(); }
};

} // namespace dsa
