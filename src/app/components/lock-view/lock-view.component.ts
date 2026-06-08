import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlateRowComponent } from './plate-row/plate-row.component';
import { PlateState, Direction } from '../../models/lock.model';

@Component({
  selector: 'app-lock-view',
  standalone: true,
  imports: [CommonModule, PlateRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lock-scene">
      @for (plate of platesFromFarToNear; track plate.sequence) {
        <app-plate-row
          [plate]="plate"
          [depState]="depStateFor(plate)"
          (move)="move.emit($event)"
          (select)="plateSelected.emit($event)"
          (positionSet)="positionSet.emit($event)"
          (depAdd)="depAdd.emit({ fromSeq: selectedSeq!, toSeq: plate.sequence, direction: $event })"
          (depRemove)="depRemove.emit({ fromSeq: selectedSeq!, toSeq: plate.sequence })"
        />
      }
    </div>
  `,
  styles: [`
    .lock-scene {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px;
    }
  `],
})
export class LockViewComponent {
  @Input() plates: PlateState[] = [];
  @Input() selectedSeq: number | null = null;

  @Output() move          = new EventEmitter<{ sequence: number; delta: number }>();
  @Output() plateSelected = new EventEmitter<number>();
  @Output() positionSet   = new EventEmitter<{ sequence: number; position: number }>();
  @Output() depAdd        = new EventEmitter<{ fromSeq: number; toSeq: number; direction: Direction }>();
  @Output() depRemove     = new EventEmitter<{ fromSeq: number; toSeq: number }>();

  get platesFromFarToNear(): PlateState[] {
    return [...this.plates].reverse();
  }

  private get selectedDeps(): Map<number, Direction> {
    const sel = this.plates.find(p => p.sequence === this.selectedSeq);
    return new Map(sel?.dependencies.map(d => [d.plateSequence, d.direction]) ?? []);
  }

  depStateFor(plate: PlateState): 'none' | 'eligible' | 'parallel' | 'opposite' {
    if (this.selectedSeq === null || plate.sequence === this.selectedSeq) return 'none';
    const dir = this.selectedDeps.get(plate.sequence);
    if (dir === 'PARALLEL') return 'parallel';
    if (dir === 'OPPOSITE') return 'opposite';
    return 'eligible';
  }
}
