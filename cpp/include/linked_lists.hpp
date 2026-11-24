#pragma once

#include "linear_structures.hpp"
#include <cstddef>
#include <stdexcept>

namespace dsa {

template <typename T>
class SinglyLinkedList {
public:
    struct Node {
        T data;
        Node* next;
        explicit Node(const T& d) : data(d), next(nullptr) {}
    };

private:
    Node* head_;
    Node* tail_;
    size_t size_;

public:
    SinglyLinkedList() : head_(nullptr), tail_(nullptr), size_(0) {}
    ~SinglyLinkedList() { clear(); }

    void pushFront(const T& val) {
        Node* n = new Node(val);
        MemoryTracker::recordAlloc(1);
        n->next = head_;
        head_ = n;
        if (tail_ == nullptr) tail_ = n;
        ++size_;
    }

    void pushBack(const T& val) {
        Node* n = new Node(val);
        MemoryTracker::recordAlloc(1);
        if (tail_ == nullptr) {
            head_ = tail_ = n;
        } else {
            tail_->next = n;
            tail_ = n;
        }
        ++size_;
    }

    bool removeFirst(const T& val) {
        Node* prev = nullptr;
        Node* curr = head_;
        while (curr != nullptr) {
            if (curr->data == val) {
                if (prev == nullptr) head_ = curr->next;
                else prev->next = curr->next;
                if (curr == tail_) tail_ = prev;
                delete curr;
                MemoryTracker::recordFree(1);
                --size_;
                return true;
            }
            prev = curr;
            curr = curr->next;
        }
        return false;
    }

    bool contains(const T& val) const {
        Node* curr = head_;
        while (curr != nullptr) {
            if (curr->data == val) return true;
            curr = curr->next;
        }
        return false;
    }

    void clear() {
        Node* curr = head_;
        while (curr != nullptr) {
            Node* nxt = curr->next;
            delete curr;
            MemoryTracker::recordFree(1);
            curr = nxt;
        }
        head_ = tail_ = nullptr;
        size_ = 0;
    }

    Node* head() const { return head_; }
    size_t size() const { return size_; }
    bool empty() const { return size_ == 0; }
    size_t memoryBytes() const { return sizeof(*this) + size_ * sizeof(Node); }
};

template <typename T>
class DoublyLinkedList {
public:
    struct Node {
        T data;
        Node* prev;
        Node* next;
        explicit Node(const T& d) : data(d), prev(nullptr), next(nullptr) {}
    };

private:
    Node* head_;
    Node* tail_;
    size_t size_;

public:
    DoublyLinkedList() : head_(nullptr), tail_(nullptr), size_(0) {}
    ~DoublyLinkedList() { clear(); }

    Node* pushBack(const T& val) {
        Node* n = new Node(val);
        MemoryTracker::recordAlloc(1);
        if (tail_ == nullptr) {
            head_ = tail_ = n;
        } else {
            n->prev = tail_;
            tail_->next = n;
            tail_ = n;
        }
        ++size_;
        return n;
    }

    void removeNode(Node* n) {
        if (n == nullptr) return;
        if (n->prev != nullptr) n->prev->next = n->next;
        else head_ = n->next;
        if (n->next != nullptr) n->next->prev = n->prev;
        else tail_ = n->prev;
        delete n;
        MemoryTracker::recordFree(1);
        --size_;
    }

    void clear() {
        Node* curr = head_;
        while (curr != nullptr) {
            Node* nxt = curr->next;
            delete curr;
            MemoryTracker::recordFree(1);
            curr = nxt;
        }
        head_ = tail_ = nullptr;
        size_ = 0;
    }

    Node* head() const { return head_; }
    Node* tail() const { return tail_; }
    size_t size() const { return size_; }
    size_t memoryBytes() const { return sizeof(*this) + size_ * sizeof(Node); }
};

template <typename T>
class CircularLinkedList {
public:
    struct Node {
        T data;
        Node* next;
        explicit Node(const T& d) : data(d), next(nullptr) {}
    };

private:
    Node* tail_;
    size_t size_;

public:
    CircularLinkedList() : tail_(nullptr), size_(0) {}
    ~CircularLinkedList() { clear(); }

    void pushBack(const T& val) {
        Node* n = new Node(val);
        MemoryTracker::recordAlloc(1);
        if (tail_ == nullptr) {
            n->next = n;
            tail_ = n;
        } else {
            n->next = tail_->next;
            tail_->next = n;
            tail_ = n;
        }
        ++size_;
    }

    T rotateNext() {
        if (tail_ == nullptr) throw std::out_of_range("CircularLinkedList empty");
        tail_ = tail_->next;
        return tail_->data;
    }

    void clear() {
        if (tail_ == nullptr) return;
        Node* head = tail_->next;
        tail_->next = nullptr;
        Node* curr = head;
        while (curr != nullptr) {
            Node* nxt = curr->next;
            delete curr;
            MemoryTracker::recordFree(1);
            curr = nxt;
        }
        tail_ = nullptr;
        size_ = 0;
    }

    size_t size() const { return size_; }
    size_t memoryBytes() const { return sizeof(*this) + size_ * sizeof(Node); }
};

// Orthogonal Multi-Linked List for Sparse Matrix representation
class SparseMatrix {
public:
    struct CellNode {
        int row;
        int col;
        double value;
        CellNode* right;
        CellNode* down;
        CellNode(int r, int c, double v)
            : row(r), col(c), value(v), right(nullptr), down(nullptr) {}
    };

private:
    int rows_;
    int cols_;
    DynamicArray<CellNode*> rowHeads_;
    DynamicArray<CellNode*> colHeads_;
    size_t nonZeroCount_;

public:
    SparseMatrix(int rows, int cols)
        : rows_(rows), cols_(cols), rowHeads_(rows), colHeads_(cols), nonZeroCount_(0) {
        for (int r = 0; r < rows_; ++r) rowHeads_.pushBack(nullptr);
        for (int c = 0; c < cols_; ++c) colHeads_.pushBack(nullptr);
    }

    ~SparseMatrix() { clear(); }

    void clear() {
        for (int r = 0; r < rows_; ++r) {
            CellNode* curr = rowHeads_[r];
            while (curr != nullptr) {
                CellNode* nxt = curr->right;
                delete curr;
                MemoryTracker::recordFree(1);
                curr = nxt;
            }
            rowHeads_[r] = nullptr;
        }
        for (int c = 0; c < cols_; ++c) colHeads_[c] = nullptr;
        nonZeroCount_ = 0;
    }

    void set(int r, int c, double val) {
        if (r < 0 || r >= rows_ || c < 0 || c >= cols_) {
            throw std::out_of_range("SparseMatrix coordinates out of range");
        }
        if (val == 0.0) {
            remove(r, c);
            return;
        }

        // Check existing in row
        CellNode* prevR = nullptr;
        CellNode* currR = rowHeads_[r];
        while (currR != nullptr && currR->col < c) {
            prevR = currR;
            currR = currR->right;
        }
        if (currR != nullptr && currR->col == c) {
            currR->value = val;
            return;
        }

        CellNode* node = new CellNode(r, c, val);
        MemoryTracker::recordAlloc(1);

        // Link into row list
        node->right = currR;
        if (prevR == nullptr) rowHeads_[r] = node;
        else prevR->right = node;

        // Link into column list
        CellNode* prevC = nullptr;
        CellNode* currC = colHeads_[c];
        while (currC != nullptr && currC->row < r) {
            prevC = currC;
            currC = currC->down;
        }
        node->down = currC;
        if (prevC == nullptr) colHeads_[c] = node;
        else prevC->down = node;

        ++nonZeroCount_;
    }

    double get(int r, int c) const {
        if (r < 0 || r >= rows_ || c < 0 || c >= cols_) return 0.0;
        CellNode* curr = rowHeads_[r];
        while (curr != nullptr && curr->col < c) {
            curr = curr->right;
        }
        if (curr != nullptr && curr->col == c) return curr->value;
        return 0.0;
    }

    bool remove(int r, int c) {
        if (r < 0 || r >= rows_ || c < 0 || c >= cols_) return false;
        CellNode* prevR = nullptr;
        CellNode* currR = rowHeads_[r];
        while (currR != nullptr && currR->col < c) {
            prevR = currR;
            currR = currR->right;
        }
        if (currR == nullptr || currR->col != c) return false;

        if (prevR == nullptr) rowHeads_[r] = currR->right;
        else prevR->right = currR->right;

        CellNode* prevC = nullptr;
        CellNode* currC = colHeads_[c];
        while (currC != nullptr && currC->row < r) {
            prevC = currC;
            currC = currC->down;
        }
        if (currC == currR) {
            if (prevC == nullptr) colHeads_[c] = currC->down;
            else prevC->down = currC->down;
        }

        delete currR;
        MemoryTracker::recordFree(1);
        --nonZeroCount_;
        return true;
    }

    size_t nonZeroCount() const { return nonZeroCount_; }
    size_t sparseMemoryBytes() const {
        return sizeof(*this) + rowHeads_.memoryBytes() + colHeads_.memoryBytes() + nonZeroCount_ * sizeof(CellNode);
    }
    size_t denseMemoryBytes() const {
        return static_cast<size_t>(rows_) * static_cast<size_t>(cols_) * sizeof(double);
    }
};

} // namespace dsa
