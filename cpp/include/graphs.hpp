#pragma once

#include "linear_structures.hpp"
#include "trees.hpp"
#include <algorithm>
#include <limits>

namespace dsa {

class DisjointSet {
private:
    DynamicArray<int> parent_;
    DynamicArray<int> rank_;

public:
    explicit DisjointSet(int n) : parent_(n), rank_(n) {
        for (int i = 0; i < n; ++i) {
            parent_.pushBack(i);
            rank_.pushBack(0);
        }
    }

    int find(int x) {
        if (parent_[x] != x) parent_[x] = find(parent_[x]);
        return parent_[x];
    }

    bool unite(int a, int b) {
        int ra = find(a);
        int rb = find(b);
        if (ra == rb) return false;
        if (rank_[ra] < rank_[rb]) std::swap(ra, rb);
        parent_[rb] = ra;
        if (rank_[ra] == rank_[rb]) rank_[ra]++;
        return true;
    }
};

struct GraphEdge {
    int u;
    int v;
    double weight;
};

class Graph {
private:
    int numVertices_;
    bool directed_;
    DynamicArray<DynamicArray<GraphEdge>> adj_;
    DynamicArray<DynamicArray<double>> matrix_;

public:
    Graph(int n, bool directed = false)
        : numVertices_(n), directed_(directed), adj_(n), matrix_(n) {
        const double INF = std::numeric_limits<double>::infinity();
        for (int i = 0; i < n; ++i) {
            adj_.pushBack(DynamicArray<GraphEdge>());
            DynamicArray<double> row(n);
            for (int j = 0; j < n; ++j) row.pushBack(i == j ? 0.0 : INF);
            matrix_.pushBack(std::move(row));
        }
    }

    void addEdge(int u, int v, double w = 1.0) {
        if (u < 0 || u >= numVertices_ || v < 0 || v >= numVertices_) return;
        adj_[u].pushBack({u, v, w});
        matrix_[u][v] = w;
        if (!directed_) {
            adj_[v].pushBack({v, u, w});
            matrix_[v][u] = w;
        }
    }

    DynamicArray<int> bfs(int start) const {
        DynamicArray<int> order;
        if (start < 0 || start >= numVertices_) return order;
        DynamicArray<bool> visited(numVertices_);
        for (int i = 0; i < numVertices_; ++i) visited.pushBack(false);
        Queue<int> q;
        visited[start] = true;
        q.enqueue(start);
        while (!q.empty()) {
            int u = q.dequeue();
            order.pushBack(u);
            for (size_t i = 0; i < adj_[u].size(); ++i) {
                int v = adj_[u][i].v;
                if (!visited[v]) {
                    visited[v] = true;
                    q.enqueue(v);
                }
            }
        }
        return order;
    }

    DynamicArray<int> dfs(int start) const {
        DynamicArray<int> order;
        if (start < 0 || start >= numVertices_) return order;
        DynamicArray<bool> visited(numVertices_);
        for (int i = 0; i < numVertices_; ++i) visited.pushBack(false);
        Stack<int> st;
        st.push(start);
        while (!st.empty()) {
            int u = st.pop();
            if (visited[u]) continue;
            visited[u] = true;
            order.pushBack(u);
            for (int i = static_cast<int>(adj_[u].size()) - 1; i >= 0; --i) {
                int v = adj_[u][i].v;
                if (!visited[v]) st.push(v);
            }
        }
        return order;
    }

    DynamicArray<double> dijkstra(int start) const {
        const double INF = std::numeric_limits<double>::infinity();
        DynamicArray<double> dist(numVertices_);
        for (int i = 0; i < numVertices_; ++i) dist.pushBack(INF);
        if (start < 0 || start >= numVertices_) return dist;

        struct State {
            double d;
            int u;
            bool operator<(const State& o) const { return d < o.d; }
            bool operator>(const State& o) const { return d > o.d; }
        };
        BinaryHeap<State> pq(true);
        dist[start] = 0.0;
        pq.push({0.0, start});
        while (!pq.empty()) {
            State cur = pq.pop();
            if (cur.d > dist[cur.u]) continue;
            for (size_t i = 0; i < adj_[cur.u].size(); ++i) {
                const auto& e = adj_[cur.u][i];
                if (dist[cur.u] + e.weight < dist[e.v]) {
                    dist[e.v] = dist[cur.u] + e.weight;
                    pq.push({dist[e.v], e.v});
                }
            }
        }
        return dist;
    }

    DynamicArray<double> bellmanFord(int start, bool& hasNegCycle) const {
        const double INF = std::numeric_limits<double>::infinity();
        DynamicArray<double> dist(numVertices_);
        for (int i = 0; i < numVertices_; ++i) dist.pushBack(INF);
        hasNegCycle = false;
        if (start < 0 || start >= numVertices_) return dist;
        dist[start] = 0.0;

        for (int iter = 0; iter < numVertices_ - 1; ++iter) {
            bool updated = false;
            for (int u = 0; u < numVertices_; ++u) {
                if (dist[u] == INF) continue;
                for (size_t i = 0; i < adj_[u].size(); ++i) {
                    const auto& e = adj_[u][i];
                    if (dist[u] + e.weight < dist[e.v]) {
                        dist[e.v] = dist[u] + e.weight;
                        updated = true;
                    }
                }
            }
            if (!updated) break;
        }

        for (int u = 0; u < numVertices_; ++u) {
            if (dist[u] == INF) continue;
            for (size_t i = 0; i < adj_[u].size(); ++i) {
                const auto& e = adj_[u][i];
                if (dist[u] + e.weight < dist[e.v]) {
                    hasNegCycle = true;
                    return dist;
                }
            }
        }
        return dist;
    }

    DynamicArray<DynamicArray<double>> floydWarshall() const {
        DynamicArray<DynamicArray<double>> dist = matrix_;
        const double INF = std::numeric_limits<double>::infinity();
        for (int k = 0; k < numVertices_; ++k) {
            for (int i = 0; i < numVertices_; ++i) {
                if (dist[i][k] == INF) continue;
                for (int j = 0; j < numVertices_; ++j) {
                    if (dist[k][j] == INF) continue;
                    if (dist[i][k] + dist[k][j] < dist[i][j]) {
                        dist[i][j] = dist[i][k] + dist[k][j];
                    }
                }
            }
        }
        return dist;
    }

    double primMST(DynamicArray<GraphEdge>& mstEdges) const {
        const double INF = std::numeric_limits<double>::infinity();
        DynamicArray<bool> inMST(numVertices_);
        DynamicArray<double> key(numVertices_);
        DynamicArray<int> parent(numVertices_);
        for (int i = 0; i < numVertices_; ++i) {
            inMST.pushBack(false);
            key.pushBack(INF);
            parent.pushBack(-1);
        }
        key[0] = 0.0;
        double total = 0.0;
        for (int count = 0; count < numVertices_; ++count) {
            int u = -1;
            double best = INF;
            for (int v = 0; v < numVertices_; ++v) {
                if (!inMST[v] && key[v] < best) {
                    best = key[v];
                    u = v;
                }
            }
            if (u == -1) break;
            inMST[u] = true;
            total += key[u];
            if (parent[u] != -1) mstEdges.pushBack({parent[u], u, key[u]});
            for (size_t i = 0; i < adj_[u].size(); ++i) {
                const auto& e = adj_[u][i];
                if (!inMST[e.v] && e.weight < key[e.v]) {
                    key[e.v] = e.weight;
                    parent[e.v] = u;
                }
            }
        }
        return total;
    }

    double kruskalMST(DynamicArray<GraphEdge>& mstEdges) const {
        DynamicArray<GraphEdge> edges;
        for (int u = 0; u < numVertices_; ++u) {
            for (size_t i = 0; i < adj_[u].size(); ++i) {
                if (directed_ || adj_[u][i].u < adj_[u][i].v) {
                    edges.pushBack(adj_[u][i]);
                }
            }
        }
        // Manual insertion/merge sort on edges by weight
        for (size_t i = 1; i < edges.size(); ++i) {
            GraphEdge key = edges[i];
            int j = static_cast<int>(i) - 1;
            while (j >= 0 && edges[j].weight > key.weight) {
                edges[j + 1] = edges[j];
                --j;
            }
            edges[j + 1] = key;
        }
        DisjointSet dsu(numVertices_);
        double total = 0.0;
        for (size_t i = 0; i < edges.size(); ++i) {
            if (dsu.unite(edges[i].u, edges[i].v)) {
                mstEdges.pushBack(edges[i]);
                total += edges[i].weight;
            }
        }
        return total;
    }
};

} // namespace dsa
