#pragma once

#include "linear_structures.hpp"
#include <algorithm>
#include <cmath>
#include <limits>

namespace dsa {

// 1. Segment Tree (Range Min / Max / Sum with dynamic point updates)
class SegmentTree {
private:
    int n_;
    DynamicArray<int> minTree_;
    DynamicArray<int> maxTree_;
    DynamicArray<long long> sumTree_;

    void build(const int* arr, int node, int start, int end) {
        if (start == end) {
            minTree_[node] = arr[start];
            maxTree_[node] = arr[start];
            sumTree_[node] = arr[start];
            return;
        }
        int mid = start + (end - start) / 2;
        build(arr, 2 * node, start, mid);
        build(arr, 2 * node + 1, mid + 1, end);
        minTree_[node] = std::min(minTree_[2 * node], minTree_[2 * node + 1]);
        maxTree_[node] = std::max(maxTree_[2 * node], maxTree_[2 * node + 1]);
        sumTree_[node] = sumTree_[2 * node] + sumTree_[2 * node + 1];
    }

    void updateRec(int node, int start, int end, int idx, int val) {
        if (start == end) {
            minTree_[node] = val;
            maxTree_[node] = val;
            sumTree_[node] = val;
            return;
        }
        int mid = start + (end - start) / 2;
        if (idx <= mid) updateRec(2 * node, start, mid, idx, val);
        else updateRec(2 * node + 1, mid + 1, end, idx, val);
        minTree_[node] = std::min(minTree_[2 * node], minTree_[2 * node + 1]);
        maxTree_[node] = std::max(maxTree_[2 * node], maxTree_[2 * node + 1]);
        sumTree_[node] = sumTree_[2 * node] + sumTree_[2 * node + 1];
    }

    int queryMinRec(int node, int start, int end, int l, int r) const {
        if (r < start || end < l) return std::numeric_limits<int>::max();
        if (l <= start && end <= r) return minTree_[node];
        int mid = start + (end - start) / 2;
        return std::min(queryMinRec(2 * node, start, mid, l, r),
                        queryMinRec(2 * node + 1, mid + 1, end, l, r));
    }

    int queryMaxRec(int node, int start, int end, int l, int r) const {
        if (r < start || end < l) return std::numeric_limits<int>::min();
        if (l <= start && end <= r) return maxTree_[node];
        int mid = start + (end - start) / 2;
        return std::max(queryMaxRec(2 * node, start, mid, l, r),
                        queryMaxRec(2 * node + 1, mid + 1, end, l, r));
    }

public:
    SegmentTree(const int* arr, int n) : n_(n), minTree_(4 * n + 4), maxTree_(4 * n + 4), sumTree_(4 * n + 4) {
        for (int i = 0; i < 4 * n + 4; ++i) {
            minTree_.pushBack(std::numeric_limits<int>::max());
            maxTree_.pushBack(std::numeric_limits<int>::min());
            sumTree_.pushBack(0);
        }
        if (n > 0) build(arr, 1, 0, n - 1);
    }

    void update(int idx, int val) {
        if (idx >= 0 && idx < n_) updateRec(1, 0, n_ - 1, idx, val);
    }

    int queryMin(int l, int r) const {
        if (n_ == 0 || l > r) return 0;
        return queryMinRec(1, 0, n_ - 1, l, r);
    }

    int queryMax(int l, int r) const {
        if (n_ == 0 || l > r) return 0;
        return queryMaxRec(1, 0, n_ - 1, l, r);
    }
};

// 2. Interval Tree
class IntervalTree {
public:
    struct Interval {
        int low, high, id;
    };
    struct Node {
        Interval interval;
        int maxHigh;
        Node* left;
        Node* right;
        explicit Node(const Interval& in) : interval(in), maxHigh(in.high), left(nullptr), right(nullptr) {}
    };

private:
    Node* root_ = nullptr;

    Node* insertRec(Node* n, const Interval& in) {
        if (!n) {
            MemoryTracker::recordAlloc(1);
            return new Node(in);
        }
        if (in.low < n->interval.low) n->left = insertRec(n->left, in);
        else n->right = insertRec(n->right, in);
        if (n->maxHigh < in.high) n->maxHigh = in.high;
        return n;
    }

    void overlapRec(Node* n, int low, int high, DynamicArray<Interval>& out) const {
        if (!n) return;
        if (n->interval.low <= high && low <= n->interval.high) {
            out.pushBack(n->interval);
        }
        if (n->left && n->left->maxHigh >= low) {
            overlapRec(n->left, low, high, out);
        }
        overlapRec(n->right, low, high, out);
    }

    void destroy(Node* n) {
        if (!n) return;
        destroy(n->left);
        destroy(n->right);
        delete n;
        MemoryTracker::recordFree(1);
    }

public:
    ~IntervalTree() { destroy(root_); }
    void insert(int low, int high, int id) { root_ = insertRec(root_, {low, high, id}); }
    DynamicArray<Interval> queryOverlapping(int low, int high) const {
        DynamicArray<Interval> res;
        overlapRec(root_, low, high, res);
        return res;
    }
};

// 3. KD-Tree (2D Spatial Nearest-Neighbor Search)
class KDTree {
public:
    struct Point {
        double x, y;
        int id;
    };
    struct Node {
        Point pt;
        Node* left;
        Node* right;
        explicit Node(const Point& p) : pt(p), left(nullptr), right(nullptr) {}
    };

private:
    Node* root_ = nullptr;

    Node* insertRec(Node* n, const Point& p, int depth) {
        if (!n) {
            MemoryTracker::recordAlloc(1);
            return new Node(p);
        }
        int cd = depth % 2;
        if ((cd == 0 && p.x < n->pt.x) || (cd == 1 && p.y < n->pt.y)) {
            n->left = insertRec(n->left, p, depth + 1);
        } else {
            n->right = insertRec(n->right, p, depth + 1);
        }
        return n;
    }

    static double distSq(const Point& a, const Point& b) {
        double dx = a.x - b.x;
        double dy = a.y - b.y;
        return dx * dx + dy * dy;
    }

    void nearestRec(Node* n, const Point& target, int depth, Point& best, double& bestDistSq) const {
        if (!n) return;
        double d = distSq(n->pt, target);
        if (d < bestDistSq) {
            bestDistSq = d;
            best = n->pt;
        }
        int cd = depth % 2;
        double diff = (cd == 0) ? (target.x - n->pt.x) : (target.y - n->pt.y);
        Node* nearBranch = (diff < 0) ? n->left : n->right;
        Node* farBranch = (diff < 0) ? n->right : n->left;
        nearestRec(nearBranch, target, depth + 1, best, bestDistSq);
        if (diff * diff < bestDistSq) {
            nearestRec(farBranch, target, depth + 1, best, bestDistSq);
        }
    }

    void destroy(Node* n) {
        if (!n) return;
        destroy(n->left);
        destroy(n->right);
        delete n;
        MemoryTracker::recordFree(1);
    }

public:
    ~KDTree() { destroy(root_); }
    void insert(const Point& p) { root_ = insertRec(root_, p, 0); }
    bool nearest(double x, double y, Point& out) const {
        if (!root_) return false;
        double bestD = std::numeric_limits<double>::max();
        nearestRec(root_, {x, y, -1}, 0, out, bestD);
        return true;
    }
};

// 4. QuadTree (2D Spatial Partitioning)
class QuadTree {
public:
    struct Entity {
        double x, y;
        int id;
    };
    struct Box {
        double x, y, w, h;
        bool contains(double px, double py) const {
            return px >= x && px <= x + w && py >= y && py <= y + h;
        }
        bool intersectsCircle(double cx, double cy, double r) const {
            double closestX = std::max(x, std::min(cx, x + w));
            double closestY = std::max(y, std::min(cy, y + h));
            double dx = cx - closestX;
            double dy = cy - closestY;
            return dx * dx + dy * dy <= r * r;
        }
    };

private:
    Box boundary_;
    size_t capacity_;
    DynamicArray<Entity> entities_;
    bool divided_ = false;
    QuadTree* nw_ = nullptr;
    QuadTree* ne_ = nullptr;
    QuadTree* sw_ = nullptr;
    QuadTree* se_ = nullptr;

    void subdivide() {
        double hw = boundary_.w * 0.5;
        double hh = boundary_.h * 0.5;
        nw_ = new QuadTree({boundary_.x, boundary_.y, hw, hh}, capacity_);
        ne_ = new QuadTree({boundary_.x + hw, boundary_.y, hw, hh}, capacity_);
        sw_ = new QuadTree({boundary_.x, boundary_.y + hh, hw, hh}, capacity_);
        se_ = new QuadTree({boundary_.x + hw, boundary_.y + hh, hw, hh}, capacity_);
        MemoryTracker::recordAlloc(4);
        divided_ = true;
    }

public:
    QuadTree(const Box& b, size_t cap = 4) : boundary_(b), capacity_(cap) {}
    ~QuadTree() {
        if (divided_) {
            delete nw_;
            delete ne_;
            delete sw_;
            delete se_;
            MemoryTracker::recordFree(4);
        }
    }

    bool insert(const Entity& e) {
        if (!boundary_.contains(e.x, e.y)) return false;
        if (entities_.size() < capacity_) {
            entities_.pushBack(e);
            return true;
        }
        if (!divided_) subdivide();
        return nw_->insert(e) || ne_->insert(e) || sw_->insert(e) || se_->insert(e);
    }

    void queryRadius(double cx, double cy, double r, DynamicArray<Entity>& out) const {
        if (!boundary_.intersectsCircle(cx, cy, r)) return;
        double rSq = r * r;
        for (size_t i = 0; i < entities_.size(); ++i) {
            double dx = entities_[i].x - cx;
            double dy = entities_[i].y - cy;
            if (dx * dx + dy * dy <= rSq) {
                out.pushBack(entities_[i]);
            }
        }
        if (divided_) {
            nw_->queryRadius(cx, cy, r, out);
            ne_->queryRadius(cx, cy, r, out);
            sw_->queryRadius(cx, cy, r, out);
            se_->queryRadius(cx, cy, r, out);
        }
    }
};

} // namespace dsa
