import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlateState } from '../../../models/lock.model';

/**
 * Plate-row visualization:
 *
 *   ◄   [ ][ ][●][ ][ ][ ][ ]   ►
 *             ↑ fixed pin (center)
 *             plate (7 cells) slides left/right
 *
 * Pin stays fixed at the center line.
 * Pressing ◄ slides the plate LEFT  → position +1 (higher-numbered cell under pin).
 * Pressing ► slides the plate RIGHT → position -1 (lower-numbered cell under pin).
 *
 * CELL_W = 44px (40px cell + 4px gap). Track = 7 × 44 – 4 = 304px total.
 * translateX(−(position − 4) × 44px) keeps cell[position] under the pin.
 */

const CELL_W = 44; // px per cell slot (cell width + gap)

@Component({
  selector: 'app-plate-row',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="plate-row"
      [class.selected]="plate.highlighted"
      [class.solved]="plate.position === GOAL"
      [class.dep-source]="plate.depSource"
      (click)="select.emit(plate.sequence)"
    >
      <!-- Sequence label -->
      <span class="plate-label">{{ plate.sequence }}</span>

      <!-- ◄ = plate slides LEFT → position +1 -->
      <button
        class="move-btn"
        [disabled]="plate.position >= MAX_POS"
        (click)="$event.stopPropagation(); move.emit({ sequence: plate.sequence, delta: +1 })"
        title="Move left"
      >◄</button>

      <!-- Track viewport: fixed width, overflow hidden, pin overlay -->
      <div class="track-viewport">

        <!-- Fixed vertical pin line -->
        <div class="pin-line"></div>

        <!-- Sliding plate cells -->
        <div class="track" [style.transform]="'translateX(' + trackOffset + 'px)'">
          @for (cell of CELLS; track cell) {
            <div
              class="cell"
              [class.goal]="cell === GOAL"
              [class.current]="cell === plate.position"
              (click)="positionSet.emit({ sequence: plate.sequence, position: cell })"
            >
              @if (cell !== plate.position) {
                <span class="cell-num">{{ cell }}</span>
              }
            </div>
          }
        </div>

        <!-- Pin symbol, fixed at center, layered on top -->
        <div class="pin-symbol">⬡</div>
      </div>

      <!-- ► = plate slides RIGHT → position -1 -->
      <button
        class="move-btn"
        [disabled]="plate.position <= MIN_POS"
        (click)="$event.stopPropagation(); move.emit({ sequence: plate.sequence, delta: -1 })"
        title="Move right"
      >►</button>

      <!-- Dependency badges -->
      @if (plate.dependencies.length) {
        <div class="deps">
          @for (dep of plate.dependencies; track dep.plateSequence) {
            <span
              class="dep-badge"
              [class.parallel]="dep.direction === 'PARALLEL'"
              [class.opposite]="dep.direction === 'OPPOSITE'"
              [title]="dep.direction === 'PARALLEL' ? 'Parallel' : 'Opposite'"
            >{{ dep.direction === 'PARALLEL' ? '⇉' : '⇄' }}{{ dep.plateSequence }}</span>
          }
        </div>
      }

      @if (plate.highlighted) {
        <span class="selected-badge">selected</span>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .plate-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: linear-gradient(135deg, #ffffff 0%, #f8f8ff 100%);
      border: 2px solid #d8d8f0;
      border-radius: 8px;
      cursor: pointer;
      transition: border-color .2s, box-shadow .2s;
      user-select: none;

      &:hover      { border-color: #8888cc; }
      &.selected   { border-color: #7070dd; background: linear-gradient(135deg, #eeeeff 0%, #e8e8ff 100%); box-shadow: 0 2px 10px #8080dd30; }
      &.solved     { border-color: #4caf50; box-shadow: 0 0 12px #4caf5022; }
      &.dep-source {
        opacity: 0.4;
        pointer-events: none;
        border-color: #ccc;
        filter: grayscale(0.6);
      }
    }

    .plate-label {
      width: 20px;
      text-align: center;
      font-size: 11px;
      color: #aaa;
      font-weight: 700;
      flex-shrink: 0;
    }

    .move-btn {
      width: 30px;
      height: 30px;
      flex-shrink: 0;
      background: #eeeeff;
      border: 1px solid #ccccee;
      border-radius: 4px;
      color: #666;
      cursor: pointer;
      font-size: 13px;
      transition: background .15s, color .15s;

      &:hover:not(:disabled) { background: #d8d8f4; color: #1a1a2e; }
      &:disabled { opacity: 0.2; cursor: not-allowed; }
    }

    /* ── Track ──────────────────────────────────────── */
    .track-viewport {
      position: relative;
      /* 7 cells × 40px + 6 gaps × 4px = 304px — show exactly 7 cells at position 4;
         edge cells slide off-screen as plate moves */
      width: 304px;
      height: 40px;
      overflow: hidden;
      flex-shrink: 0;
    }

    /* Fixed vertical pin line (centre of viewport) */
    .pin-line {
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 42px;
      transform: translateX(-50%);
      background: rgba(100, 100, 200, 0.08);
      border-left:  2px solid rgba(100, 100, 200, 0.3);
      border-right: 2px solid rgba(100, 100, 200, 0.3);
      border-radius: 4px;
      pointer-events: none;
      z-index: 1;
    }

    /* Sliding plate track */
    .track {
      position: absolute;
      left: 0;
      top: 0;
      display: flex;
      gap: 4px;
      /* Transition gives the sliding animation */
      transition: transform .25s cubic-bezier(.4, 0, .2, 1);
    }

    .cell {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      border: 1px solid #d8d8ee;
      border-radius: 4px;
      background: #f8f8ff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      cursor: pointer;
      transition: background .2s, border-color .2s;

      &:hover:not(.current) { border-color: #a0a0cc; background: #ededff; }
      &.goal    { border-color: #81c784; background: #e8f5e9; }
      &.current { background: #eaeaff; border-color: #7070cc; }
      /* goal + current = the solved hole is under the pin */
      &.goal.current { background: #c8f0c8; border-color: #4caf50; }

      .cell-num {
        font-size: 11px;
        font-weight: 700;
        color: #ccc;
        pointer-events: none;
      }
      &.goal    .cell-num { color: #2e7d32; }
      &.current .cell-num { color: #7070cc; }
      &.goal.current .cell-num { color: #2e7d32; }
    }

    /* Fixed pin symbol layered on top */
    .pin-symbol {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      font-size: 20px;
      color: #5050cc;
      z-index: 2;
      pointer-events: none;
      line-height: 1;
    }

    /* Dependency badges */
    .deps {
      display: flex;
      gap: 3px;
      flex-wrap: wrap;
      max-width: 90px;
    }

    .dep-badge {
      font-size: 10px;
      padding: 2px 4px;
      border-radius: 3px;
      font-weight: 700;

      &.parallel { background: #e8f5e9; color: #2e7d32; border: 1px solid #4caf5066; }
      &.opposite { background: #fce8e8; color: #c62828; border: 1px solid #f4433666; }
    }

    .selected-badge {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 10px;
      font-weight: 700;
      background: #7070dd;
      color: #fff;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }
  `],
})
export class PlateRowComponent {
  readonly GOAL    = 4;
  readonly MIN_POS = 1;
  readonly MAX_POS = 7;
  readonly CELLS   = [1, 2, 3, 4, 5, 6, 7];

  @Input({ required: true }) plate!: PlateState;
  @Output() move        = new EventEmitter<{ sequence: number; delta: number }>();
  @Output() select      = new EventEmitter<number>();
  @Output() positionSet = new EventEmitter<{ sequence: number; position: number }>();

  /**
   * Slide the track so cell[plate.position] sits under the pin.
   * Cell 4 is naturally centred when translateX = 0 (4th of 7 = middle).
   * Each step away shifts by ±CELL_W px.
   */
  get trackOffset(): number {
    return -(this.plate.position - 4) * CELL_W;
  }
}
