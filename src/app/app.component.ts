import {
  Component,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SolverService } from './services/solver.service';
import { LockViewComponent } from './components/lock-view/lock-view.component';
import { DepEditorComponent, DepEditorResult } from './components/dep-editor/dep-editor.component';
import { SolutionPanelComponent } from './components/solution-panel/solution-panel.component';

import {
  PlateState,
  Dependency,
  SolveResponse,
  Lock,
} from './models/lock.model';

const MIN_POS   = 1;
const MAX_POS   = 7;
const GOAL      = 4;
const MAX_PLATES = 8;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, LockViewComponent, DepEditorComponent, SolutionPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly MIN_POS    = MIN_POS;
  readonly MAX_POS    = MAX_POS;
  readonly MAX_PLATES = MAX_PLATES;

  private readonly solver = inject(SolverService);

  // ── State ──────────────────────────────────────────────────────────────────
  readonly plates        = signal<PlateState[]>([]);
  readonly solving       = signal(false);
  readonly solveResponse = signal<SolveResponse | null>(null);
  readonly solveError    = signal<string | null>(null);
  readonly selectedSeq   = signal<number | null>(null);

  /** Start positions snapshot — restored on Reset */
  private startPositions = new Map<number, number>();

  // Dep-editor two-click flow
  readonly depEditorFrom = signal<number | null>(null);
  readonly depEditorTo   = signal<number | null>(null);
  readonly depEditorSource = signal<number | null>(null);

  // ── Plate management ───────────────────────────────────────────────────────
  addPlate(): void {
    const ps = this.plates();
    if (ps.length >= MAX_PLATES) return;
    const seq = ps.length === 0 ? 1 : Math.max(...ps.map(p => p.sequence)) + 1;
    const plate: PlateState = { sequence: seq, position: GOAL, dependencies: [], highlighted: false, depSource: false };
    this.plates.update(arr => [...arr, plate]);
    this.startPositions.set(seq, GOAL);
    this.solveResponse.set(null);
  }

  removePlate(seq: number): void {
    this.plates.update(ps =>
      ps
        .filter(p => p.sequence !== seq)
        .map(p => ({ ...p, dependencies: p.dependencies.filter(d => d.plateSequence !== seq) }))
    );
    this.startPositions.delete(seq);
    if (this.selectedSeq() === seq) this.selectedSeq.set(null);
    this.solveResponse.set(null);
  }

  setPosition(seq: number, raw: number): void {
    const pos = Math.max(MIN_POS, Math.min(MAX_POS, Number(raw) || GOAL));
    this.plates.update(ps => ps.map(p => p.sequence === seq ? { ...p, position: pos } : p));
    this.startPositions.set(seq, pos);
    this.solveResponse.set(null);
  }

  plateBySeq(seq: number): PlateState | undefined {
    return this.plates().find(p => p.sequence === seq);
  }

  // ── Selection / dep-editor ─────────────────────────────────────────────────
  onPlateSelected(seq: number): void {
    const src = this.depEditorSource();
    if (src !== null && src !== seq) {
      this.depEditorFrom.set(src);
      this.depEditorTo.set(seq);
      this.depEditorSource.set(null);
      this.clearHighlights();
      return;
    }
    this.depEditorSource.set(null);
    if (this.selectedSeq() === seq) {
      this.selectedSeq.set(null);
      this.clearHighlights();
      return;
    }
    this.selectedSeq.set(seq);
    this.plates.update(ps => ps.map(p => ({ ...p, highlighted: p.sequence === seq })));
  }

  clearAllPlates(): void {
    this.plates.set([]);
    this.startPositions.clear();
    this.selectedSeq.set(null);
    this.solveResponse.set(null);
    this.solveError.set(null);
    this.depEditorFrom.set(null);
    this.depEditorTo.set(null);
    this.depEditorSource.set(null);
  }

  startAddDep(fromSeq: number): void {
    this.depEditorSource.set(fromSeq);
    // Source plate → depSource (visually disabled); others → normal
    this.plates.update(ps => ps.map(p => ({
      ...p,
      highlighted: false,
      depSource: p.sequence === fromSeq,
    })));
  }

  cancelDepEditor(): void {
    this.depEditorFrom.set(null);
    this.depEditorTo.set(null);
    this.depEditorSource.set(null);
    this.restoreHighlight();
  }

  addDep(result: DepEditorResult): void {
    this.plates.update(ps => ps.map(p => {
      const base = { ...p, depSource: false };
      if (p.sequence !== result.fromSequence) return base;
      if (p.dependencies.some(d => d.plateSequence === result.toSequence)) return base;
      return { ...base, dependencies: [...p.dependencies, { plateSequence: result.toSequence, direction: result.direction }] };
    }));
    this.depEditorFrom.set(null);
    this.depEditorTo.set(null);
    this.solveResponse.set(null);
    this.restoreHighlight();
  }

  removeDep(fromSeq: number, toSeq: number): void {
    this.plates.update(ps => ps.map(p =>
      p.sequence === fromSeq
        ? { ...p, dependencies: p.dependencies.filter(d => d.plateSequence !== toSeq) }
        : p
    ));
    this.solveResponse.set(null);
  }

  private clearHighlights(): void {
    this.plates.update(ps => ps.map(p => ({ ...p, highlighted: false, depSource: false })));
  }

  private restoreHighlight(): void {
    const sel = this.selectedSeq();
    this.plates.update(ps => ps.map(p => ({ ...p, highlighted: p.sequence === sel, depSource: false })));
  }

  // ── Manual move ────────────────────────────────────────────────────────────
  manualMove(event: { sequence: number; delta: number }): void {
    this.applyPhysicalMove(event.sequence, event.delta);
    this.solveResponse.set(null);
  }

  private applyPhysicalMove(seq: number, delta: number): void {
    const moving = this.plates().find(p => p.sequence === seq);
    if (!moving) return;

    const posMap = new Map(this.plates().map(p => [p.sequence, p.position]));
    const changes = new Map<number, number>([[seq, delta]]);
    for (const dep of moving.dependencies) {
      const d = dep.direction === 'PARALLEL' ? delta : -delta;
      changes.set(dep.plateSequence, (changes.get(dep.plateSequence) ?? 0) + d);
    }

    for (const [s, d] of changes) {
      const newPos = (posMap.get(s) ?? GOAL) + d;
      if (newPos < MIN_POS || newPos > MAX_POS) return;
    }

    this.plates.update(ps => ps.map(p => {
      const d = changes.get(p.sequence);
      return d !== undefined ? { ...p, position: p.position + d } : p;
    }));
  }

  // ── Solve ──────────────────────────────────────────────────────────────────
  solve(): void {
    if (this.solving() || this.plates().length === 0) return;
    this.solving.set(true);
    this.solveError.set(null);
    this.solveResponse.set(null);

    // Save current positions as the "start" for this solve attempt
    this.plates().forEach(p => this.startPositions.set(p.sequence, p.position));

    const lock: Lock = {
      plates: this.plates().map(p => ({
        sequence: p.sequence,
        startPosition: p.position,
        dependencies: p.dependencies,
      })),
    };

    this.solver.solve(lock).subscribe({
      next:  (resp) => { this.solveResponse.set(resp); this.solving.set(false); },
      error: (err)  => {
        this.solveError.set(err?.error?.detail ?? err?.message ?? 'Solve error');
        this.solving.set(false);
      },
    });
  }

  // ── Playback ───────────────────────────────────────────────────────────────
  applyStep(event: { plateSequence: number; delta: number; count: number }): void {
    for (let i = 0; i < event.count; i++) {
      this.applyPhysicalMove(event.plateSequence, event.delta);
    }
    this.plates.update(ps => ps.map(p => ({
      ...p, highlighted: p.sequence === event.plateSequence,
    })));
  }

  resetPositions(): void {
    this.plates.update(ps => ps.map(p => ({
      ...p,
      position: this.startPositions.get(p.sequence) ?? GOAL,
      highlighted: false,
    })));
  }
}
