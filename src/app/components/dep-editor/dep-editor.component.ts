import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Direction } from '../../models/lock.model';

export interface DepEditorResult {
  fromSequence: number;
  toSequence: number;
  direction: Direction;
}

@Component({
  selector: 'app-dep-editor',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="cancel.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3 class="modal-title">Add Dependency</h3>

        <div class="relation">
          <div class="plate-box source">Plate {{ fromSequence }}</div>
          <div class="arrow">→</div>
          <div class="plate-box target">Plate {{ toSequence }}</div>
        </div>

        <p class="hint">
          When Plate {{ fromSequence }} moves, Plate {{ toSequence }} moves:
        </p>

        <div class="type-buttons">
          <button
            class="type-btn"
            [class.active]="selectedDir() === 'PARALLEL'"
            (click)="selectedDir.set('PARALLEL')"
          >
            ⇉ Parallel
            <small>In the same direction</small>
          </button>
          <button
            class="type-btn"
            [class.active]="selectedDir() === 'OPPOSITE'"
            (click)="selectedDir.set('OPPOSITE')"
          >
            ⇄ Opposite
            <small>In the opposite direction</small>
          </button>
        </div>

        <div class="actions">
          <button class="btn-cancel" (click)="cancel.emit()">Cancel</button>
          <button class="btn-add" (click)="confirm()">Add</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      background: #00000044;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.15s ease;
    }

    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

    .modal {
      background: #ffffff;
      border: 1px solid #dde0f0;
      border-radius: 12px;
      padding: 28px 32px;
      width: 380px;
      box-shadow: 0 20px 60px #00000020;
    }

    .modal-title {
      margin: 0 0 20px;
      font-size: 18px;
      color: #3030a0;
      font-weight: 600;
    }

    .relation {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
    }

    .plate-box {
      flex: 1;
      padding: 10px;
      border-radius: 8px;
      text-align: center;
      font-weight: 700;
      font-size: 14px;
      &.source { background: #eeeeff; border: 2px solid #7070dd; color: #3030a0; }
      &.target { background: #e8f5e9; border: 2px solid #4caf50; color: #2e7d32; }
    }

    .arrow { font-size: 24px; color: #bbb; }

    .hint { color: #666; font-size: 13px; margin-bottom: 16px; }

    .type-buttons {
      display: flex;
      gap: 10px;
      margin-bottom: 24px;
    }

    .type-btn {
      flex: 1;
      padding: 12px;
      border-radius: 8px;
      border: 2px solid #dde0f0;
      background: #f8f8ff;
      color: #444;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      transition: border-color 0.15s, background 0.15s;

      small { font-size: 11px; color: #999; }

      &:hover { border-color: #aaa; }
      &.active {
        border-color: #7070dd;
        background: #eeeeff;
        color: #3030a0;
        small { color: #6060b0; }
      }
    }

    .actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .btn-cancel {
      padding: 9px 20px;
      border-radius: 6px;
      border: 1px solid #dde0f0;
      background: transparent;
      color: #666;
      cursor: pointer;
      &:hover { background: #f0f0f0; color: #333; }
    }

    .btn-add {
      padding: 9px 20px;
      border-radius: 6px;
      border: none;
      background: #4444aa;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      &:hover { background: #5555cc; }
    }
  `],
})
export class DepEditorComponent {
  @Input({ required: true }) fromSequence!: number;
  @Input({ required: true }) toSequence!: number;
  @Output() confirmed = new EventEmitter<DepEditorResult>();
  @Output() cancel = new EventEmitter<void>();

  readonly selectedDir = signal<Direction>('PARALLEL');

  confirm(): void {
    this.confirmed.emit({
      fromSequence: this.fromSequence,
      toSequence: this.toSequence,
      direction: this.selectedDir(),
    });
  }
}
