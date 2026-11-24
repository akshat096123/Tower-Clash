#pragma once

#include "linear_structures.hpp"

namespace dsa {

class RatInMaze {
public:
    static bool solve(const DynamicArray<DynamicArray<int>>& maze,
                      DynamicArray<DynamicArray<int>>& solution) {
        int n = static_cast<int>(maze.size());
        if (n == 0) return false;
        int m = static_cast<int>(maze[0].size());
        for (int r = 0; r < n; ++r) {
            DynamicArray<int> row(m);
            for (int c = 0; c < m; ++c) row.pushBack(0);
            solution.pushBack(std::move(row));
        }
        return backtrack(maze, 0, 0, n, m, solution);
    }

private:
    static bool backtrack(const DynamicArray<DynamicArray<int>>& maze,
                          int r, int c, int n, int m,
                          DynamicArray<DynamicArray<int>>& sol) {
        if (r < 0 || r >= n || c < 0 || c >= m || maze[r][c] == 1 || sol[r][c] == 1) {
            return false;
        }
        sol[r][c] = 1;
        if (r == n - 1 && c == m - 1) return true;
        if (backtrack(maze, r, c + 1, n, m, sol)) return true;
        if (backtrack(maze, r + 1, c, n, m, sol)) return true;
        if (backtrack(maze, r, c - 1, n, m, sol)) return true;
        if (backtrack(maze, r - 1, c, n, m, sol)) return true;
        sol[r][c] = 0;
        return false;
    }
};

class NQueens {
public:
    static int countSolutions(int n, DynamicArray<int>& firstSolution) {
        DynamicArray<int> cols(n);
        for (int i = 0; i < n; ++i) cols.pushBack(-1);
        int count = 0;
        solveRec(0, n, cols, count, firstSolution);
        return count;
    }

private:
    static bool isSafe(const DynamicArray<int>& cols, int row, int col) {
        for (int r = 0; r < row; ++r) {
            int c = cols[r];
            if (c == col || (row - r) == (col > c ? col - c : c - col)) {
                return false;
            }
        }
        return true;
    }

    static void solveRec(int row, int n, DynamicArray<int>& cols, int& count, DynamicArray<int>& firstSolution) {
        if (row == n) {
            if (count == 0) {
                for (int i = 0; i < n; ++i) firstSolution.pushBack(cols[i]);
            }
            count++;
            return;
        }
        for (int c = 0; c < n; ++c) {
            if (isSafe(cols, row, c)) {
                cols[row] = c;
                solveRec(row + 1, n, cols, count, firstSolution);
                cols[row] = -1;
            }
        }
    }
};

} // namespace dsa
