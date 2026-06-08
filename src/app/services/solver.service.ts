import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Lock, Step, SolveResponse } from '../models/lock.model';

// ── Internal types ────────────────────────────────────────────────────────────

interface Action {
  plateIndex: number;
  plateSequence: number;
  moveDirection: number; // +1 = LEFT, -1 = RIGHT
  deltas: [number, number][]; // [plateIndex, signedDelta]
}

interface PreparedLock {
  start: number;
  goal: number;
  actions: Action[];
  plateCount: number;
  pow7: number[];
}

interface HeapEntry {
  f: number;
  h: number;
  g: number;
  order: number;
  state: number;
}

// ── MinHeap ───────────────────────────────────────────────────────────────────

function compareEntries(a: HeapEntry, b: HeapEntry): number {
  if (a.f !== b.f) return a.f - b.f;
  if (a.h !== b.h) return a.h - b.h;
  if (a.g !== b.g) return a.g - b.g;
  return a.order - b.order;
}

class MinHeap {
  private data: HeapEntry[] = [];

  get size(): number { return this.data.length; }

  push(entry: HeapEntry): void {
    this.data.push(entry);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapEntry | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (compareEntries(this.data[i], this.data[parent]) < 0) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let min = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && compareEntries(this.data[l], this.data[min]) < 0) min = l;
      if (r < n && compareEntries(this.data[r], this.data[min]) < 0) min = r;
      if (min === i) break;
      [this.data[i], this.data[min]] = [this.data[min], this.data[i]];
      i = min;
    }
  }
}

// ── State encoding ────────────────────────────────────────────────────────────

const GOAL_POSITION = 4;
const GOAL_DIGIT = GOAL_POSITION - 1; // 3
const MOVE_LEFT = +1;
const MOVE_RIGHT = -1;

function buildPow7(n: number): number[] {
  const pow7: number[] = [];
  let p = 1;
  for (let i = 0; i < n; i++) {
    pow7.push(p);
    p *= 7;
  }
  return pow7;
}

function encodePositions(positions: number[], pow7: number[]): number {
  let state = 0;
  for (let i = 0; i < positions.length; i++) {
    state += (positions[i] - 1) * pow7[i];
  }
  return state;
}

function digitAt(state: number, index: number, pow7: number[]): number {
  return Math.floor(state / pow7[index]) % 7;
}

// ── Algorithm (A* with macro-neighbors) ──────────────────────────────────────

function prepareLock(lock: Lock): PreparedLock {
  const plates = lock.plates;
  const n = plates.length;
  const seqToIdx = new Map<number, number>(plates.map((p, i) => [p.sequence, i]));
  const pow7 = buildPow7(n);

  const actions: Action[] = [];
  for (let pi = 0; pi < n; pi++) {
    const plate = plates[pi];

    // Build merged deltas for a +1 unit move of this plate.
    // PARALLEL deps move in the same direction (+1), OPPOSITE inversely (-1).
    const merged = new Map<number, number>([[pi, 1]]);
    for (const dep of plate.dependencies) {
      const di = seqToIdx.get(dep.plateSequence)!;
      const sign = dep.direction === 'PARALLEL' ? 1 : -1;
      merged.set(di, (merged.get(di) ?? 0) + sign);
    }

    for (const dir of [MOVE_LEFT, MOVE_RIGHT]) {
      const deltas: [number, number][] = [];
      for (const [idx, raw] of [...merged.entries()].sort((a, b) => a[0] - b[0])) {
        const scaled = raw * dir;
        if (scaled !== 0) deltas.push([idx, scaled]);
      }
      actions.push({ plateIndex: pi, plateSequence: plate.sequence, moveDirection: dir, deltas });
    }
  }

  return {
    start: encodePositions(plates.map(p => p.startPosition), pow7),
    goal: encodePositions(Array(n).fill(GOAL_POSITION), pow7),
    actions,
    plateCount: n,
    pow7,
  };
}

// Bounds are checked against the ORIGINAL state so all plate moves are
// validated atomically before any are applied.
function applyOnce(state: number, action: Action, pow7: number[]): number | null {
  let nextState = state;
  for (const [index, delta] of action.deltas) {
    const nextDigit = digitAt(state, index, pow7) + delta;
    if (nextDigit < 0 || nextDigit >= 7) return null;
    nextState += delta * pow7[index];
  }
  return nextState;
}

// Each repeated application creates a separate graph edge so A* can stop at
// any intermediate position, not just the wall.
function macroNeighbors(state: number, actions: Action[], pow7: number[]): [number, Step][] {
  const neighbors: [number, Step][] = [];
  for (const action of actions) {
    let current = state;
    let count = 0;
    while (true) {
      const next = applyOnce(current, action, pow7);
      if (next === null) break;
      current = next;
      count++;
      neighbors.push([
        current,
        {
          plateSequence: action.plateSequence,
          direction: action.moveDirection === MOVE_LEFT ? 'LEFT' : 'RIGHT',
          count,
        },
      ]);
    }
  }
  return neighbors;
}

function heuristic(state: number, plateCount: number, pow7: number[]): number {
  let h = 0;
  for (let i = 0; i < plateCount; i++) {
    h += Math.abs(digitAt(state, i, pow7) - GOAL_DIGIT);
  }
  return h;
}

function reconstructPath(goalState: number, parent: Map<number, [number, Step] | null>): Step[] {
  const steps: Step[] = [];
  let current = goalState;
  while (parent.has(current) && parent.get(current) !== null) {
    const entry = parent.get(current)!;
    steps.push(entry[1]);
    current = entry[0];
  }
  steps.reverse();
  return steps;
}

function astar(prepared: PreparedLock): { steps: Step[] | null; expandedStates: number } {
  const { start, goal, actions, plateCount, pow7 } = prepared;

  if (start === goal) return { steps: [], expandedStates: 0 };

  const bestCost = new Map<number, number>([[start, 0]]);
  const parent = new Map<number, [number, Step] | null>([[start, null]]);

  const heap = new MinHeap();
  const startH = heuristic(start, plateCount, pow7);
  heap.push({ f: startH, h: startH, g: 0, order: 0, state: start });

  let pushOrder = 1;
  let expanded = 0;

  while (heap.size > 0) {
    const { g: cost, state } = heap.pop()!;

    // Lazy deletion: skip stale entries superseded by a cheaper path.
    if (cost !== bestCost.get(state)) continue;
    expanded++;

    if (state === goal) {
      return { steps: reconstructPath(state, parent), expandedStates: expanded };
    }

    for (const [nextState, step] of macroNeighbors(state, actions, pow7)) {
      const nextCost = cost + 1;
      if (nextCost >= (bestCost.get(nextState) ?? Infinity)) continue;
      bestCost.set(nextState, nextCost);
      parent.set(nextState, [state, step]);
      const h = heuristic(nextState, plateCount, pow7);
      heap.push({ f: nextCost + h, h, g: nextCost, order: pushOrder++, state: nextState });
    }
  }

  return { steps: null, expandedStates: expanded };
}

// ── Angular service ───────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SolverService {

  solve(lock: Lock): Observable<SolveResponse> {
    return new Observable<SolveResponse>(subscriber => {
      // setTimeout(0) yields one event-loop tick so Angular can render the
      // "solving…" spinner before synchronous computation begins.
      const timerId = setTimeout(() => {
        const t0 = performance.now();
        try {
          const prepared = prepareLock(lock);
          const { steps, expandedStates } = astar(prepared);
          const elapsedMs = performance.now() - t0;
          subscriber.next({ solved: steps !== null, steps, elapsedMs, expandedStates });
          subscriber.complete();
        } catch (err) {
          subscriber.error(err instanceof Error ? err : new Error(String(err)));
        }
      }, 0);

      return () => clearTimeout(timerId);
    });
  }
}
