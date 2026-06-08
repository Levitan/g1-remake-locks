export type Direction = 'PARALLEL' | 'OPPOSITE';
export type MoveDirection = 'LEFT' | 'RIGHT';

export interface Dependency {
  plateSequence: number;
  direction: Direction;
}

export interface Plate {
  sequence: number;
  startPosition: number; // 1–7
  dependencies: Dependency[];
}

export interface Lock {
  plates: Plate[];
}

export interface Step {
  plateSequence: number;
  direction: MoveDirection;
  count: number;
}

export interface SolveResponse {
  solved: boolean;
  steps: Step[] | null;
  elapsedMs: number;
  expandedStates: number;
}

/** Runtime state for a single plate during visualization */
export interface PlateState {
  sequence: number;
  position: number; // current 1–7
  dependencies: Dependency[];
  highlighted: boolean;
  /** True while this plate is the source of a pending dep-add action */
  depSource: boolean;
}
