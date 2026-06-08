import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Step, SolveResponse } from '../../models/lock.model';

@Component({
  selector: 'app-solution-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <h3 class="panel-title">Solution</h3>

      <!-- Idle -->
      <p *ngIf="!response" class="hint">Click Solve to find a solution.</p>

      <!-- No solution -->
      <div *ngIf="response && !response.solved" class="no-solution">
        <span class="icon">⚠️</span>
        <p>No solution exists.</p>
      </div>

      <!-- Solution found -->
      <ng-container *ngIf="response?.solved">
        <div class="meta">
          <span class="badge">{{ response!.steps!.length }} steps</span>
          <span class="badge secondary">{{ response!.elapsedMs.toFixed(1) }} ms</span>
          <span class="badge secondary">{{ response!.expandedStates }} states</span>
        </div>

        <div class="steps-list">
          <div
            *ngFor="let step of response!.steps; let i = index"
            class="step-item"
            [class.active]="i === currentStep()"
            [class.done]="i < currentStep()"
          >
            <span class="step-num">{{ i + 1 }}</span>
            <span class="step-plate">Plate {{ step.plateSequence }}</span>
            <span class="step-dir" [class.left]="step.direction === 'LEFT'">
              {{ step.direction === 'LEFT' ? '◄' : '►' }}
            </span>
            <span class="step-count">×{{ step.count }}</span>
          </div>
        </div>

        <div class="playback">
          <button class="btn-reset" (click)="reset()">↺ Reset</button>
          <button
            *ngIf="!playing()"
            class="btn-play"
            [disabled]="currentStep() >= (response?.steps?.length ?? 0)"
            (click)="play()"
          >▶ Play</button>
          <button *ngIf="playing()" class="btn-pause" (click)="pause()">⏸ Pause</button>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .panel-title {
      margin: 0;
      font-size: 16px;
      color: #3030a0;
      font-weight: 600;
    }

    .hint { color: #aaa; font-size: 13px; margin: 0; }

    .no-solution {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #fff3f3;
      border-radius: 8px;
      border: 1px solid #f4433666;
      color: #c62828;
      p { margin: 0; }
    }

    .meta {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .badge {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      background: #e8e8ff;
      color: #3030a0;
      &.secondary { background: #f0f0f0; color: #666; }
    }

    .steps-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 320px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 6px;
      background: #f8f8ff;
      border: 1px solid transparent;
      font-size: 13px;
      transition: background 0.2s, border-color 0.2s;

      &.active {
        background: #eeeeff;
        border-color: #7070dd;
        font-weight: 600;
      }
      &.done {
        opacity: 0.4;
      }
    }

    .step-num { color: #bbb; width: 18px; text-align: right; font-size: 11px; }
    .step-plate { flex: 1; color: #444; }
    .step-dir {
      font-size: 14px;
      color: #aaa;
      &.left { color: #4040c0; }
    }
    .step-count { color: #c06020; font-weight: 700; min-width: 28px; text-align: right; }

    .playback {
      display: flex;
      gap: 8px;
      padding-top: 4px;
    }

    .btn-reset, .btn-play, .btn-pause {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      transition: background 0.15s;
    }
    .btn-reset {
      background: #f0f0f0;
      color: #666;
      &:hover { background: #e0e0e0; color: #333; }
    }
    .btn-play {
      background: #e8f5e9;
      color: #2e7d32;
      flex: 1;
      &:hover:not(:disabled) { background: #c8e6c9; }
      &:disabled { opacity: 0.3; cursor: not-allowed; }
    }
    .btn-pause {
      background: #fffde7;
      color: #f57f17;
      flex: 1;
      &:hover { background: #fff9c4; }
    }
  `],
})
export class SolutionPanelComponent implements OnDestroy {
  @Input() response: SolveResponse | null = null;
  @Output() stepActivated = new EventEmitter<{ plateSequence: number; delta: number; count: number }>();
  @Output() resetRequested = new EventEmitter<void>();

  readonly currentStep = signal(0);
  readonly playing = signal(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  play(): void {
    if (!this.response?.steps) return;
    this.playing.set(true);
    this.advance();
    this.timer = setInterval(() => this.advance(), 900);
  }

  pause(): void {
    this.playing.set(false);
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  reset(): void {
    this.pause();
    this.currentStep.set(0);
    this.resetRequested.emit();
  }

  private advance(): void {
    const steps = this.response?.steps;
    if (!steps) return;
    const i = this.currentStep();
    if (i >= steps.length) { this.pause(); return; }
    const step = steps[i];
    // LEFT = plate slides left = position +1; RIGHT = plate slides right = position −1
    this.stepActivated.emit({
      plateSequence: step.plateSequence,
      delta: step.direction === 'LEFT' ? +1 : -1,
      count: step.count,
    });
    this.currentStep.set(i + 1);
    if (i + 1 >= steps.length) this.pause();
  }

  ngOnDestroy(): void { this.pause(); }
}
