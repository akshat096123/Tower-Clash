// Backtracking Algorithms: Rat in a Maze & N-Queens with step-by-step visualization

export interface MazeStep {
  pathGrid: number[][]; // 0=unvisited, 1=current path, 2=dead end
  current: [number, number];
  description: string;
}

export function solveRatInMazeTrace(maze: number[][]): {
  solved: boolean;
  steps: MazeStep[];
  finalPath: number[][];
} {
  const rows = maze.length;
  const cols = rows > 0 ? maze[0].length : 0;
  const pathGrid = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  const steps: MazeStep[] = [];
  const visited = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));

  const cloneGrid = () => pathGrid.map((r) => [...r]);

  const backtrack = (r: number, c: number): boolean => {
    if (r < 0 || r >= rows || c < 0 || c >= cols || maze[r][c] === 1 || visited[r][c]) {
      return false;
    }
    visited[r][c] = true;
    pathGrid[r][c] = 1;
    steps.push({
      pathGrid: cloneGrid(),
      current: [r, c],
      description: `Move to (${r}, ${c})`,
    });

    if (r === rows - 1 && c === cols - 1) {
      steps.push({
        pathGrid: cloneGrid(),
        current: [r, c],
        description: `Reached destination (${r}, ${c})!`,
      });
      return true;
    }

    if (
      backtrack(r, c + 1) ||
      backtrack(r + 1, c) ||
      backtrack(r, c - 1) ||
      backtrack(r - 1, c)
    ) {
      return true;
    }

    pathGrid[r][c] = 2; // dead end
    steps.push({
      pathGrid: cloneGrid(),
      current: [r, c],
      description: `Dead end at (${r}, ${c}) -> Backtrack`,
    });
    return false;
  };

  const solved = rows > 0 && cols > 0 ? backtrack(0, 0) : false;
  return { solved, steps, finalPath: cloneGrid() };
}

export interface NQueensStep {
  board: number[]; // board[row] = col or -1
  tryingRow: number;
  tryingCol: number;
  conflict: boolean;
  solutionsFound: number;
  description: string;
}

export function solveNQueensTrace(n: number): {
  totalSolutions: number;
  solutions: number[][];
  steps: NQueensStep[];
} {
  const board = new Array<number>(n).fill(-1);
  const solutions: number[][] = [];
  const steps: NQueensStep[] = [];

  const isSafe = (row: number, col: number): boolean => {
    for (let r = 0; r < row; r++) {
      const c = board[r];
      if (c === col || Math.abs(row - r) === Math.abs(col - c)) return false;
    }
    return true;
  };

  const rec = (row: number) => {
    if (row === n) {
      solutions.push([...board]);
      if (steps.length < 350) {
        steps.push({
          board: [...board],
          tryingRow: row - 1,
          tryingCol: board[row - 1],
          conflict: false,
          solutionsFound: solutions.length,
          description: `Valid configuration #${solutions.length} found!`,
        });
      }
      return;
    }
    for (let col = 0; col < n; col++) {
      const safe = isSafe(row, col);
      if (steps.length < 350) {
        steps.push({
          board: [...board],
          tryingRow: row,
          tryingCol: col,
          conflict: !safe,
          solutionsFound: solutions.length,
          description: safe
            ? `Place Queen at (row ${row}, col ${col}) -> Safe`
            : `Conflict at (row ${row}, col ${col}) -> Prune branch`,
        });
      }
      if (safe) {
        board[row] = col;
        rec(row + 1);
        board[row] = -1;
        if (steps.length < 350 && solutions.length === 0) {
          steps.push({
            board: [...board],
            tryingRow: row,
            tryingCol: col,
            conflict: false,
            solutionsFound: solutions.length,
            description: `Backtrack from (row ${row}, col ${col})`,
          });
        }
      }
    }
  };

  rec(0);
  return { totalSolutions: solutions.length, solutions, steps };
}
