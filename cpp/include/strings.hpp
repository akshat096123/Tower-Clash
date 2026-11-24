#pragma once

#include "linear_structures.hpp"
#include <cstdint>
#include <string>

namespace dsa {

class Trie {
public:
    struct Node {
        Node* children[128] = {nullptr};
        bool isEnd = false;
    };

private:
    Node* root_;

    void destroy(Node* n) {
        if (!n) return;
        for (int i = 0; i < 128; ++i) {
            if (n->children[i]) destroy(n->children[i]);
        }
        delete n;
        MemoryTracker::recordFree(1);
    }

    void collect(Node* n, std::string& prefix, DynamicArray<std::string>& out) const {
        if (!n) return;
        if (n->isEnd) out.pushBack(prefix);
        for (int c = 0; c < 128; ++c) {
            if (n->children[c]) {
                prefix.push_back(static_cast<char>(c));
                collect(n->children[c], prefix, out);
                prefix.pop_back();
            }
        }
    }

public:
    Trie() {
        root_ = new Node();
        MemoryTracker::recordAlloc(1);
    }
    ~Trie() { destroy(root_); }

    void insert(const std::string& word) {
        Node* curr = root_;
        for (unsigned char ch : word) {
            if (ch >= 128) continue;
            if (!curr->children[ch]) {
                curr->children[ch] = new Node();
                MemoryTracker::recordAlloc(1);
            }
            curr = curr->children[ch];
        }
        curr->isEnd = true;
    }

    bool search(const std::string& word) const {
        Node* curr = root_;
        for (unsigned char ch : word) {
            if (ch >= 128 || !curr->children[ch]) return false;
            curr = curr->children[ch];
        }
        return curr->isEnd;
    }

    DynamicArray<std::string> autocomplete(const std::string& prefix) const {
        DynamicArray<std::string> out;
        Node* curr = root_;
        std::string curPrefix;
        for (unsigned char ch : prefix) {
            if (ch >= 128 || !curr->children[ch]) return out;
            curr = curr->children[ch];
            curPrefix.push_back(static_cast<char>(ch));
        }
        collect(curr, curPrefix, out);
        return out;
    }
};

class SuffixArray {
private:
    std::string text_;
    DynamicArray<int> sa_;

public:
    explicit SuffixArray(const std::string& text) : text_(text) {
        int n = static_cast<int>(text_.size());
        for (int i = 0; i < n; ++i) sa_.pushBack(i);
        // Manual insertion/shell sort on suffix indices for self-contained correctness
        for (int gap = n / 2; gap > 0; gap /= 2) {
            for (int i = gap; i < n; ++i) {
                int temp = sa_[i];
                int j = i;
                while (j >= gap && text_.compare(sa_[j - gap], n - sa_[j - gap], text_, temp, n - temp) > 0) {
                    sa_[j] = sa_[j - gap];
                    j -= gap;
                }
                sa_[j] = temp;
            }
        }
    }

    int searchPattern(const std::string& pattern) const {
        int n = static_cast<int>(text_.size());
        int m = static_cast<int>(pattern.size());
        int lo = 0, hi = n - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            int cmp = text_.compare(sa_[mid], m, pattern);
            if (cmp == 0) return sa_[mid];
            if (cmp < 0) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }

    const DynamicArray<int>& array() const { return sa_; }
};

class StringHasher {
public:
    static uint64_t polynomialHash(const std::string& s, uint64_t base = 131, uint64_t mod = 1000000007ULL) {
        uint64_t h = 0;
        for (unsigned char c : s) {
            h = (h * base + c) % mod;
        }
        return h;
    }

    static DynamicArray<int> rabinKarp(const std::string& text, const std::string& pattern) {
        DynamicArray<int> matches;
        int n = static_cast<int>(text.size());
        int m = static_cast<int>(pattern.size());
        if (m == 0 || m > n) return matches;

        const uint64_t base = 256;
        const uint64_t mod = 1000000007ULL;
        uint64_t h = 1;
        for (int i = 0; i < m - 1; ++i) h = (h * base) % mod;

        uint64_t pHash = 0, tHash = 0;
        for (int i = 0; i < m; ++i) {
            pHash = (base * pHash + static_cast<unsigned char>(pattern[i])) % mod;
            tHash = (base * tHash + static_cast<unsigned char>(text[i])) % mod;
        }

        for (int i = 0; i <= n - m; ++i) {
            if (pHash == tHash) {
                bool ok = true;
                for (int j = 0; j < m; ++j) {
                    if (text[i + j] != pattern[j]) {
                        ok = false;
                        break;
                    }
                }
                if (ok) matches.pushBack(i);
            }
            if (i < n - m) {
                uint64_t left = (static_cast<unsigned char>(text[i]) * h) % mod;
                tHash = (tHash + mod - left) % mod;
                tHash = (tHash * base + static_cast<unsigned char>(text[i + m])) % mod;
            }
        }
        return matches;
    }
};

} // namespace dsa
