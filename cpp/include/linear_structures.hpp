#pragma once

#include <cstddef>
#include <stdexcept>
#include <utility>

namespace dsa {

struct MemoryTracker {
    static inline size_t activeAllocations = 0;
    static inline size_t totalAllocations = 0;
    static inline size_t totalDeallocations = 0;

    static void recordAlloc(size_t count = 1) {
        activeAllocations += count;
        totalAllocations += count;
    }

    static void recordFree(size_t count = 1) {
        if (activeAllocations >= count) activeAllocations -= count;
        totalDeallocations += count;
    }
};

template <typename T>
class DynamicArray {
private:
    T* data_;
    size_t size_;
    size_t capacity_;

    void resizeCapacity(size_t newCapacity) {
        T* next = new T[newCapacity];
        MemoryTracker::recordAlloc(1);
        for (size_t i = 0; i < size_; ++i) {
            next[i] = std::move(data_[i]);
        }
        if (data_ != nullptr) {
            delete[] data_;
            MemoryTracker::recordFree(1);
        }
        data_ = next;
        capacity_ = newCapacity;
    }

public:
    explicit DynamicArray(size_t initialCapacity = 4)
        : data_(nullptr), size_(0), capacity_(initialCapacity > 0 ? initialCapacity : 4) {
        data_ = new T[capacity_];
        MemoryTracker::recordAlloc(1);
    }

    DynamicArray(const DynamicArray& other)
        : data_(new T[other.capacity_]), size_(other.size_), capacity_(other.capacity_) {
        MemoryTracker::recordAlloc(1);
        for (size_t i = 0; i < size_; ++i) {
            data_[i] = other.data_[i];
        }
    }

    DynamicArray(DynamicArray&& other) noexcept
        : data_(other.data_), size_(other.size_), capacity_(other.capacity_) {
        other.data_ = nullptr;
        other.size_ = 0;
        other.capacity_ = 0;
    }

    DynamicArray& operator=(const DynamicArray& other) {
        if (this == &other) return *this;
        T* next = new T[other.capacity_];
        MemoryTracker::recordAlloc(1);
        for (size_t i = 0; i < other.size_; ++i) {
            next[i] = other.data_[i];
        }
        if (data_ != nullptr) {
            delete[] data_;
            MemoryTracker::recordFree(1);
        }
        data_ = next;
        size_ = other.size_;
        capacity_ = other.capacity_;
        return *this;
    }

    DynamicArray& operator=(DynamicArray&& other) noexcept {
        if (this == &other) return *this;
        if (data_ != nullptr) {
            delete[] data_;
            MemoryTracker::recordFree(1);
        }
        data_ = other.data_;
        size_ = other.size_;
        capacity_ = other.capacity_;
        other.data_ = nullptr;
        other.size_ = 0;
        other.capacity_ = 0;
        return *this;
    }

    ~DynamicArray() {
        if (data_ != nullptr) {
            delete[] data_;
            MemoryTracker::recordFree(1);
        }
    }

    void pushBack(const T& value) {
        if (size_ == capacity_) {
            resizeCapacity(capacity_ == 0 ? 4 : capacity_ * 2);
        }
        data_[size_++] = value;
    }

    void pushBack(T&& value) {
        if (size_ == capacity_) {
            resizeCapacity(capacity_ == 0 ? 4 : capacity_ * 2);
        }
        data_[size_++] = std::move(value);
    }

    void popBack() {
        if (size_ == 0) throw std::out_of_range("DynamicArray::popBack on empty array");
        --size_;
    }

    void insertAt(size_t index, const T& value) {
        if (index > size_) throw std::out_of_range("DynamicArray::insertAt out of range");
        if (size_ == capacity_) {
            resizeCapacity(capacity_ == 0 ? 4 : capacity_ * 2);
        }
        for (size_t i = size_; i > index; --i) {
            data_[i] = std::move(data_[i - 1]);
        }
        data_[index] = value;
        ++size_;
    }

    void removeAt(size_t index) {
        if (index >= size_) throw std::out_of_range("DynamicArray::removeAt out of range");
        for (size_t i = index; i + 1 < size_; ++i) {
            data_[i] = std::move(data_[i + 1]);
        }
        --size_;
    }

    void clear() { size_ = 0; }

    void reserve(size_t minCap) {
        if (minCap > capacity_) resizeCapacity(minCap);
    }

    T& operator[](size_t index) {
        if (index >= size_) throw std::out_of_range("DynamicArray index out of range");
        return data_[index];
    }

    const T& operator[](size_t index) const {
        if (index >= size_) throw std::out_of_range("DynamicArray index out of range");
        return data_[index];
    }

    size_t size() const { return size_; }
    size_t capacity() const { return capacity_; }
    bool empty() const { return size_ == 0; }
    size_t memoryBytes() const { return sizeof(*this) + capacity_ * sizeof(T); }
    T* raw() { return data_; }
    const T* raw() const { return data_; }
};

template <typename T>
class Stack {
private:
    DynamicArray<T> arr_;

public:
    void push(const T& value) { arr_.pushBack(value); }
    void push(T&& value) { arr_.pushBack(std::move(value)); }

    T pop() {
        if (arr_.empty()) throw std::out_of_range("Stack::pop on empty stack");
        T val = std::move(arr_[arr_.size() - 1]);
        arr_.popBack();
        return val;
    }

    const T& peek() const {
        if (arr_.empty()) throw std::out_of_range("Stack::peek on empty stack");
        return arr_[arr_.size() - 1];
    }

    bool empty() const { return arr_.empty(); }
    size_t size() const { return arr_.size(); }
    void clear() { arr_.clear(); }
    size_t memoryBytes() const { return arr_.memoryBytes(); }
};

template <typename T>
class Queue {
private:
    struct Node {
        T value;
        Node* next;
        explicit Node(const T& v) : value(v), next(nullptr) {}
    };
    Node* front_;
    Node* rear_;
    size_t size_;

public:
    Queue() : front_(nullptr), rear_(nullptr), size_(0) {}

    ~Queue() { clear(); }

    Queue(const Queue&) = delete;
    Queue& operator=(const Queue&) = delete;

    void enqueue(const T& value) {
        Node* node = new Node(value);
        MemoryTracker::recordAlloc(1);
        if (rear_ == nullptr) {
            front_ = rear_ = node;
        } else {
            rear_->next = node;
            rear_ = node;
        }
        ++size_;
    }

    T dequeue() {
        if (front_ == nullptr) throw std::out_of_range("Queue::dequeue on empty queue");
        Node* temp = front_;
        T val = std::move(temp->value);
        front_ = front_->next;
        if (front_ == nullptr) rear_ = nullptr;
        delete temp;
        MemoryTracker::recordFree(1);
        --size_;
        return val;
    }

    const T& front() const {
        if (front_ == nullptr) throw std::out_of_range("Queue::front on empty queue");
        return front_->value;
    }

    void clear() {
        while (front_ != nullptr) {
            Node* next = front_->next;
            delete front_;
            MemoryTracker::recordFree(1);
            front_ = next;
        }
        rear_ = nullptr;
        size_ = 0;
    }

    bool empty() const { return size_ == 0; }
    size_t size() const { return size_; }
    size_t memoryBytes() const { return sizeof(*this) + size_ * sizeof(Node); }
};

template <typename T>
class CircularQueue {
private:
    T* buffer_;
    size_t capacity_;
    size_t head_;
    size_t tail_;
    size_t count_;

public:
    explicit CircularQueue(size_t capacity = 16)
        : buffer_(new T[capacity]), capacity_(capacity), head_(0), tail_(0), count_(0) {
        MemoryTracker::recordAlloc(1);
    }

    ~CircularQueue() {
        delete[] buffer_;
        MemoryTracker::recordFree(1);
    }

    CircularQueue(const CircularQueue&) = delete;
    CircularQueue& operator=(const CircularQueue&) = delete;

    bool enqueue(const T& value) {
        if (isFull()) return false;
        buffer_[tail_] = value;
        tail_ = (tail_ + 1) % capacity_;
        ++count_;
        return true;
    }

    T dequeue() {
        if (isEmpty()) throw std::out_of_range("CircularQueue::dequeue on empty queue");
        T val = std::move(buffer_[head_]);
        head_ = (head_ + 1) % capacity_;
        --count_;
        return val;
    }

    const T& peek() const {
        if (isEmpty()) throw std::out_of_range("CircularQueue::peek on empty queue");
        return buffer_[head_];
    }

    bool isEmpty() const { return count_ == 0; }
    bool isFull() const { return count_ == capacity_; }
    size_t size() const { return count_; }
    size_t capacity() const { return capacity_; }
    size_t memoryBytes() const { return sizeof(*this) + capacity_ * sizeof(T); }
};

} // namespace dsa
