import React, { useEffect, useState } from 'react';
import { CircularQueue, DynamicArray, Queue, Stack } from '../../dsa/linear';
import { CircularLinkedList, DoublyLinkedList, SinglyLinkedList, SparseMatrix } from '../../dsa/linkedLists';
import { LabMetaUpdate } from './SearchSortHashLab';

interface Props {
  mode: 'linear' | 'linked';
  onMetaChange: (meta: LabMetaUpdate) => void;
}

export const LinearAndLinkedLab: React.FC<Props> = ({ mode, onMetaChange }) => {
  const [linearType, setLinearType] = useState<'dynamic_array' | 'stack' | 'queue' | 'circular_queue'>('stack');
  const [linkedType, setLinkedType] = useState<'singly' | 'doubly' | 'circular' | 'sparse_matrix'>('sparse_matrix');
  const [valInput, setValInput] = useState('42');
  const [rowIn, setRowIn] = useState('2');
  const [colIn, setColIn] = useState('3');
  const [version, setVersion] = useState(0);

  const [dynArr] = useState(() => {
    const d = new DynamicArray<number>(4);
    [10, 25, 40].forEach((x) => d.pushBack(x));
    return d;
  });
  const [stack] = useState(() => {
    const s = new Stack<number>();
    [101, 202, 303].forEach((x) => s.push(x));
    return s;
  });
  const [queue] = useState(() => {
    const q = new Queue<number>();
    [1, 2, 3].forEach((x) => q.enqueue(x));
    return q;
  });
  const [cQueue] = useState(() => {
    const cq = new CircularQueue<number>(6);
    [11, 22, 33].forEach((x) => cq.enqueue(x));
    return cq;
  });

  const [sll] = useState(() => {
    const l = new SinglyLinkedList<number>();
    [12, 24, 36].forEach((x) => l.pushBack(x));
    return l;
  });
  const [dll] = useState(() => {
    const l = new DoublyLinkedList<number>();
    [100, 200, 300].forEach((x) => l.pushBack(x));
    return l;
  });
  const [cll] = useState(() => {
    const l = new CircularLinkedList<number>();
    [7, 14, 21].forEach((x) => l.pushBack(x));
    return l;
  });
  const [sparse] = useState(() => {
    const sm = new SparseMatrix(6, 8);
    sm.set(0, 1, 5, 'Crystal');
    sm.set(2, 4, 12, 'Tower');
    sm.set(4, 6, 9, 'Portal');
    return sm;
  });

  const [statusLine, setStatusLine] = useState('Interactive memory & pointer inspection ready.');
  const bump = (msg: string) => {
    setStatusLine(msg);
    setVersion((v) => v + 1);
  };

  useEffect(() => {
    if (mode === 'linear') {
      const names = {
        dynamic_array: 'Dynamic Array (Doubling Buffer)',
        stack: 'Stack (LIFO)',
        queue: 'Queue (FIFO Linked)',
        circular_queue: 'Circular Queue (Ring Buffer)',
      };
      onMetaChange({
        name: names[linearType],
        explanation: 'Manual contiguous / node-based linear ADT with explicit capacity & pointer tracking.',
        application: 'Undo stack for tower placements, FIFO wave queue, circular event scheduler.',
        bestCase: 'O(1)',
        avgCase: 'O(1)',
        worstCase: linearType === 'dynamic_array' ? 'O(n) resize' : 'O(1)',
        space: 'O(n)',
        currentOp: statusLine,
        comparisons: version,
        swaps: 0,
      });
    } else {
      const names = {
        singly: 'Singly Linked List',
        doubly: 'Doubly Linked List',
        circular: 'Circular Linked List',
        sparse_matrix: 'Multi-Linked Sparse Matrix',
      };
      onMetaChange({
        name: names[linkedType],
        explanation:
          linkedType === 'sparse_matrix'
            ? 'Orthogonal multi-linked list storing only non-zero cells with row & column pointers.'
            : 'Pointer-linked nodes supporting dynamic O(1) insertion and removal.',
        application: 'Active enemy management & sparse terrain representation.',
        bestCase: 'O(1)',
        avgCase: 'O(1) – O(n)',
        worstCase: 'O(n)',
        space: 'O(k) non-zero',
        currentOp: statusLine,
        comparisons: version,
        swaps: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, linearType, linkedType, statusLine]);

  if (mode === 'linear') {
    const cqState = cQueue.getPointers();
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {([
            ['dynamic_array', 'Dynamic Array'],
            ['stack', 'Stack'],
            ['queue', 'Queue'],
            ['circular_queue', 'Circular Queue'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLinearType(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                linearType === id
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900 text-slate-300 border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label htmlFor="lin-val" className="block text-xs text-slate-400 mb-1">Value</label>
            <input
              id="lin-val"
              type="number"
              value={valInput}
              onChange={(e) => setValInput(e.target.value)}
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white w-28"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const v = Number(valInput) || 0;
              if (linearType === 'dynamic_array') {
                dynArr.pushBack(v);
                bump(`Pushed ${v}. Size=${dynArr.size}, Capacity=${dynArr.capacity}`);
              } else if (linearType === 'stack') {
                stack.push(v);
                bump(`Stack.push(${v})`);
              } else if (linearType === 'queue') {
                queue.enqueue(v);
                bump(`Queue.enqueue(${v})`);
              } else {
                const ok = cQueue.enqueue(v);
                bump(ok ? `CircularQueue.enqueue(${v})` : 'CircularQueue is FULL!');
              }
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950"
          >
            {linearType === 'stack' ? 'Push' : linearType.includes('queue') ? 'Enqueue' : 'PushBack'}
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                if (linearType === 'dynamic_array') {
                  const x = dynArr.popBack();
                  bump(`Popped ${x} from DynamicArray`);
                } else if (linearType === 'stack') {
                  const x = stack.pop();
                  bump(`Stack.pop() -> ${x}`);
                } else if (linearType === 'queue') {
                  const x = queue.dequeue();
                  bump(`Queue.dequeue() -> ${x}`);
                } else {
                  const x = cQueue.dequeue();
                  bump(`CircularQueue.dequeue() -> ${x}`);
                }
              } catch (e) {
                bump((e as Error).message);
              }
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/35"
          >
            {linearType === 'stack' ? 'Pop' : linearType.includes('queue') ? 'Dequeue' : 'PopBack'}
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#060b16] p-5 space-y-4">
          {linearType === 'dynamic_array' && (
            <div>
              <p className="text-xs text-slate-400 mb-2">
                Size: <strong className="text-cyan-300">{dynArr.size}</strong> | Capacity:{' '}
                <strong className="text-amber-300">{dynArr.capacity}</strong> | Memory:{' '}
                <strong className="text-emerald-300">{dynArr.memoryBytes()} bytes</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: dynArr.capacity }, (_, i) => (
                  <div
                    key={i}
                    className={`w-14 h-14 rounded-lg border flex flex-col items-center justify-center font-mono text-xs ${
                      i < dynArr.size
                        ? 'bg-cyan-500/15 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900/50 border-dashed border-slate-700 text-slate-600'
                    }`}
                  >
                    <span className="font-bold">{i < dynArr.size ? dynArr.get(i) : '—'}</span>
                    <span className="text-[10px] opacity-60">[{i}]</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {linearType === 'stack' && (
            <div className="flex flex-col-reverse items-center gap-1.5">
              {stack.toArray().map((item, i, arr) => (
                <div
                  key={i}
                  className={`w-44 py-2 text-center rounded-lg border font-mono text-sm ${
                    i === arr.length - 1
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                      : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}
                >
                  {item} {i === arr.length - 1 ? '← TOP' : ''}
                </div>
              ))}
            </div>
          )}

          {linearType === 'queue' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-emerald-400">FRONT →</span>
              {queue.toArray().map((item, i) => (
                <div key={i} className="px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400 font-mono text-sm text-cyan-200">
                  {item}
                </div>
              ))}
              <span className="text-xs font-mono text-rose-400">← REAR</span>
            </div>
          )}

          {linearType === 'circular_queue' && (
            <div className="space-y-2">
              <p className="text-xs font-mono text-slate-400">
                head={cqState.head} | tail={cqState.tail} | count={cqState.count}/{cqState.capacity}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {cqState.slots.map((val, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-center font-mono text-xs ${
                      val !== undefined
                        ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-500'
                    }`}
                  >
                    <p className="text-[10px] text-slate-400">
                      [{idx}] {idx === cqState.head ? 'H' : ''} {idx === cqState.tail ? 'T' : ''}
                    </p>
                    <p className="text-sm font-bold">{val ?? 'empty'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Linked Lists & Sparse Matrix
  const mem = sparse.memoryComparison();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          ['singly', 'Singly Linked'],
          ['doubly', 'Doubly Linked'],
          ['circular', 'Circular Linked'],
          ['sparse_matrix', 'Sparse Matrix (Multi-Linked)'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setLinkedType(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              linkedType === id
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-slate-900 text-slate-300 border-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {linkedType === 'sparse_matrix' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end text-xs">
            <div>
              <label htmlFor="sm-row" className="block text-slate-400 mb-1">Row (0-5)</label>
              <input id="sm-row" type="number" min={0} max={5} value={rowIn} onChange={(e) => setRowIn(e.target.value)} className="w-16 rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-white" />
            </div>
            <div>
              <label htmlFor="sm-col" className="block text-slate-400 mb-1">Col (0-7)</label>
              <input id="sm-col" type="number" min={0} max={7} value={colIn} onChange={(e) => setColIn(e.target.value)} className="w-16 rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-white" />
            </div>
            <div>
              <label htmlFor="sm-val" className="block text-slate-400 mb-1">Value</label>
              <input id="sm-val" type="number" value={valInput} onChange={(e) => setValInput(e.target.value)} className="w-20 rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-white" />
            </div>
            <button
              type="button"
              onClick={() => {
                const r = Math.max(0, Math.min(5, Number(rowIn) || 0));
                const c = Math.max(0, Math.min(7, Number(colIn) || 0));
                const v = Number(valInput) || 0;
                sparse.set(r, c, v, 'Cell');
                bump(`Set SparseMatrix(${r},${c}) = ${v}`);
              }}
              className="px-3 py-1.5 rounded-lg font-bold bg-cyan-500 text-slate-950"
            >
              Insert / Update
            </button>
            <button
              type="button"
              onClick={() => {
                const r = Math.max(0, Math.min(5, Number(rowIn) || 0));
                const c = Math.max(0, Math.min(7, Number(colIn) || 0));
                sparse.remove(r, c);
                bump(`Removed node at (${r},${c})`);
              }}
              className="px-3 py-1.5 rounded-lg font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/35"
            >
              Delete Cell
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-slate-900 p-2.5">Non-Zero Nodes: <strong className="text-cyan-300">{sparse.nonZeroCount}</strong></div>
            <div className="rounded-lg bg-slate-900 p-2.5">Sparse Mem: <strong className="text-emerald-300">{mem.sparseBytes} B</strong></div>
            <div className="rounded-lg bg-slate-900 p-2.5">Dense 2D Mem: <strong className="text-rose-300">{mem.denseBytes} B</strong></div>
          </div>

          <div className="grid grid-cols-8 gap-1 p-3 rounded-xl bg-[#060b16] border border-slate-800">
            {Array.from({ length: 6 }, (_, r) =>
              Array.from({ length: 8 }, (_, c) => {
                const v = sparse.get(r, c);
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`p-2 rounded text-center font-mono text-xs border ${
                      v !== 0
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold'
                        : 'bg-slate-900/40 border-slate-800/70 text-slate-600'
                    }`}
                  >
                    {v}
                  </div>
                );
              })
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
              <p className="text-cyan-300 font-bold mb-1">Row-Wise Traversal:</p>
              <p className="text-slate-300">
                {sparse.traverseRowWise().map((x) => `(${x.row},${x.col}):${x.value}`).join(' → ') || 'Empty'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
              <p className="text-purple-300 font-bold mb-1">Column-Wise Traversal:</p>
              <p className="text-slate-300">
                {sparse.traverseColWise().map((x) => `(${x.row},${x.col}):${x.value}`).join(' ↓ ') || 'Empty'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end text-xs">
            <div>
              <label htmlFor="ll-val" className="block text-slate-400 mb-1">Node Value</label>
              <input
                id="ll-val"
                type="number"
                value={valInput}
                onChange={(e) => setValInput(e.target.value)}
                className="w-24 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const v = Number(valInput) || 0;
                if (linkedType === 'singly') sll.pushBack(v);
                else if (linkedType === 'doubly') dll.pushBack(v);
                else cll.pushBack(v);
                bump(`Inserted ${v} into ${linkedType} list`);
              }}
              className="px-3.5 py-1.5 rounded-lg font-bold bg-emerald-500 text-slate-950"
            >
              Insert Tail
            </button>
            <button
              type="button"
              onClick={() => {
                const v = Number(valInput) || 0;
                const ok =
                  linkedType === 'singly'
                    ? sll.removeByPredicate((x) => x === v)
                    : linkedType === 'doubly'
                    ? dll.removeByPredicate((x) => x === v)
                    : cll.removeFirst((x) => x === v);
                bump(ok ? `Removed ${v}` : `Value ${v} not found`);
              }}
              className="px-3.5 py-1.5 rounded-lg font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/35"
            >
              Delete Value
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#060b16] p-5 flex flex-wrap items-center gap-2">
            {(linkedType === 'singly' ? sll.toArray() : linkedType === 'doubly' ? dll.toArray() : cll.toArray()).map(
              (item, idx, arr) => (
                <React.Fragment key={`${item}-${idx}`}>
                  <div className="px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400 font-mono text-sm text-cyan-200">
                    {item}
                  </div>
                  {idx < arr.length - 1 && (
                    <span className="text-slate-400 font-mono">{linkedType === 'doubly' ? '⇄' : '→'}</span>
                  )}
                </React.Fragment>
              )
            )}
            <span className="text-xs font-mono text-amber-300 ml-2">
              {linkedType === 'circular' ? '↺ (loops to HEAD)' : '→ NULL'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

