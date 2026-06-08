import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlateRowComponent } from './plate-row/plate-row.component';
import { PlateState } from '../../models/lock.model';

@Component({
  selector: 'app-lock-view',
  standalone: true,
  imports: [CommonModule, PlateRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lock-scene">
      <!-- Plate N at top (far), plate 1 at bottom (near) -->
      @for (plate of platesFromFarToNear; track plate.sequence) {
        <app-plate-row
          [plate]="plate"
          (move)="move.emit($event)"
          (select)="plateSelected.emit($event)"
          (positionSet)="positionSet.emit($event)"
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
  @Output() move        = new EventEmitter<{ sequence: number; delta: number }>();
  @Output() plateSelected = new EventEmitter<number>();
  @Output() positionSet = new EventEmitter<{ sequence: number; position: number }>();

  get platesFromFarToNear(): PlateState[] {
    return [...this.plates].reverse();
  }
}
