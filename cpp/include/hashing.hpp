#pragma once

#include "linear_structures.hpp"
#include <cstddef>
#include <stdexcept>
#include <string>

namespace dsa {

enum class CollisionStrategy {
    SeparateChaining,
    LinearProbing,
    QuadraticProbing,
    DoubleHashing
};

template <typename V>
class HashTable {
private:
    struct ChainNode {
        std::string key;
        V value;
        ChainNode* next;
        ChainNode(const std::string& k, const V& v) : key(k), value(v), next(nullptr) {}
    };

    enum class SlotState { Empty, Occupied, Deleted };

    struct ProbeSlot {
        std::string key;
        V value{};
        SlotState state = SlotState::Empty;
    };

    CollisionStrategy strategy_;
    size_t capacity_;
    size_t count_;
    long long totalCollisions_;
    ChainNode** chains_;
    ProbeSlot* slots_;

    size_t primaryHash(const std::string& key) const {
        // FNV-1a 64-bit hash
        size_t hash = 1469598103934665603ULL;
        for (unsigned char c : key) {
            hash ^= c;
            hash *= 1099511628211ULL;
        }
        return hash % capacity_;
    }

    size_t secondaryHash(const std::string& key) const {
        size_t h = 0;
        for (unsigned char c : key) {
            h = h * 31 + c;
        }
        size_t step = 1 + (h % (capacity_ > 2 ? capacity_ - 1 : 1));
        return step == 0 ? 1 : step;
    }

    static size_t nextPrime(size_t n) {
        auto isPrime = [](size_t x) {
            if (x < 2) return false;
            for (size_t i = 2; i * i <= x; ++i) {
                if (x % i == 0) return false;
            }
            return true;
        };
        while (!isPrime(n)) ++n;
        return n;
    }

    void rehash(size_t newCap) {
        newCap = nextPrime(newCap);
        HashTable<V> nextTable(strategy_, newCap);
        if (strategy_ == CollisionStrategy::SeparateChaining) {
            for (size_t i = 0; i < capacity_; ++i) {
                ChainNode* curr = chains_[i];
                while (curr != nullptr) {
                    nextTable.insert(curr->key, curr->value);
                    curr = curr->next;
                }
            }
        } else {
            for (size_t i = 0; i < capacity_; ++i) {
                if (slots_[i].state == SlotState::Occupied) {
                    nextTable.insert(slots_[i].key, slots_[i].value);
                }
            }
        }
        std::swap(capacity_, nextTable.capacity_);
        std::swap(count_, nextTable.count_);
        std::swap(chains_, nextTable.chains_);
        std::swap(slots_, nextTable.slots_);
    }

public:
    explicit HashTable(CollisionStrategy strategy = CollisionStrategy::SeparateChaining, size_t initialCap = 17)
        : strategy_(strategy),
          capacity_(nextPrime(initialCap)),
          count_(0),
          totalCollisions_(0),
          chains_(nullptr),
          slots_(nullptr) {
        if (strategy_ == CollisionStrategy::SeparateChaining) {
            chains_ = new ChainNode*[capacity_]();
            MemoryTracker::recordAlloc(1);
        } else {
            slots_ = new ProbeSlot[capacity_]();
            MemoryTracker::recordAlloc(1);
        }
    }

    ~HashTable() {
        if (chains_ != nullptr) {
            for (size_t i = 0; i < capacity_; ++i) {
                ChainNode* curr = chains_[i];
                while (curr != nullptr) {
                    ChainNode* nxt = curr->next;
                    delete curr;
                    MemoryTracker::recordFree(1);
                    curr = nxt;
                }
            }
            delete[] chains_;
            MemoryTracker::recordFree(1);
        }
        if (slots_ != nullptr) {
            delete[] slots_;
            MemoryTracker::recordFree(1);
        }
    }

    HashTable(const HashTable&) = delete;
    HashTable& operator=(const HashTable&) = delete;

    void insert(const std::string& key, const V& value) {
        double lf = static_cast<double>(count_ + 1) / static_cast<double>(capacity_);
        if ((strategy_ == CollisionStrategy::SeparateChaining && lf > 0.85) ||
            (strategy_ != CollisionStrategy::SeparateChaining && lf > 0.65)) {
            rehash(capacity_ * 2);
        }

        size_t h1 = primaryHash(key);
        if (strategy_ == CollisionStrategy::SeparateChaining) {
            ChainNode* curr = chains_[h1];
            if (curr != nullptr) totalCollisions_++;
            while (curr != nullptr) {
                if (curr->key == key) {
                    curr->value = value;
                    return;
                }
                curr = curr->next;
            }
            ChainNode* node = new ChainNode(key, value);
            MemoryTracker::recordAlloc(1);
            node->next = chains_[h1];
            chains_[h1] = node;
            ++count_;
            return;
        }

        size_t h2 = secondaryHash(key);
        size_t firstDeleted = capacity_;
        for (size_t i = 0; i < capacity_; ++i) {
            size_t idx = h1;
            if (strategy_ == CollisionStrategy::LinearProbing) {
                idx = (h1 + i) % capacity_;
            } else if (strategy_ == CollisionStrategy::QuadraticProbing) {
                idx = (h1 + i * i) % capacity_;
            } else {
                idx = (h1 + i * h2) % capacity_;
            }

            if (slots_[idx].state == SlotState::Empty) {
                size_t target = (firstDeleted != capacity_) ? firstDeleted : idx;
                slots_[target].key = key;
                slots_[target].value = value;
                slots_[target].state = SlotState::Occupied;
                ++count_;
                return;
            } else if (slots_[idx].state == SlotState::Deleted) {
                if (firstDeleted == capacity_) firstDeleted = idx;
                totalCollisions_++;
            } else if (slots_[idx].key == key) {
                slots_[idx].value = value;
                return;
            } else {
                totalCollisions_++;
            }
        }
    }

    bool find(const std::string& key, V& outValue) const {
        size_t h1 = primaryHash(key);
        if (strategy_ == CollisionStrategy::SeparateChaining) {
            ChainNode* curr = chains_[h1];
            while (curr != nullptr) {
                if (curr->key == key) {
                    outValue = curr->value;
                    return true;
                }
                curr = curr->next;
            }
            return false;
        }

        size_t h2 = secondaryHash(key);
        for (size_t i = 0; i < capacity_; ++i) {
            size_t idx = h1;
            if (strategy_ == CollisionStrategy::LinearProbing) idx = (h1 + i) % capacity_;
            else if (strategy_ == CollisionStrategy::QuadraticProbing) idx = (h1 + i * i) % capacity_;
            else idx = (h1 + i * h2) % capacity_;

            if (slots_[idx].state == SlotState::Empty) return false;
            if (slots_[idx].state == SlotState::Occupied && slots_[idx].key == key) {
                outValue = slots_[idx].value;
                return true;
            }
        }
        return false;
    }

    bool remove(const std::string& key) {
        size_t h1 = primaryHash(key);
        if (strategy_ == CollisionStrategy::SeparateChaining) {
            ChainNode* prev = nullptr;
            ChainNode* curr = chains_[h1];
            while (curr != nullptr) {
                if (curr->key == key) {
                    if (prev == nullptr) chains_[h1] = curr->next;
                    else prev->next = curr->next;
                    delete curr;
                    MemoryTracker::recordFree(1);
                    --count_;
                    return true;
                }
                prev = curr;
                curr = curr->next;
            }
            return false;
        }

        size_t h2 = secondaryHash(key);
        for (size_t i = 0; i < capacity_; ++i) {
            size_t idx = h1;
            if (strategy_ == CollisionStrategy::LinearProbing) idx = (h1 + i) % capacity_;
            else if (strategy_ == CollisionStrategy::QuadraticProbing) idx = (h1 + i * i) % capacity_;
            else idx = (h1 + i * h2) % capacity_;

            if (slots_[idx].state == SlotState::Empty) return false;
            if (slots_[idx].state == SlotState::Occupied && slots_[idx].key == key) {
                slots_[idx].state = SlotState::Deleted;
                --count_;
                return true;
            }
        }
        return false;
    }

    size_t size() const { return count_; }
    size_t capacity() const { return capacity_; }
    long long collisions() const { return totalCollisions_; }
    size_t memoryBytes() const {
        if (strategy_ == CollisionStrategy::SeparateChaining) {
            return sizeof(*this) + capacity_ * sizeof(ChainNode*) + count_ * sizeof(ChainNode);
        }
        return sizeof(*this) + capacity_ * sizeof(ProbeSlot);
    }
};

} // namespace dsa
