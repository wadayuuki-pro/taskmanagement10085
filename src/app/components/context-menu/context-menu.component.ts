import { Component, Output, EventEmitter } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [MatIconModule, MatMenuModule],
  template: `
    <div class="context-menu">
      <button mat-menu-item (click)="onDuplicate()">
        <mat-icon>content_copy</mat-icon>
        <span>タスクを複製</span>
      </button>
    </div>
  `,
  styles: [`
    .context-menu {
      background: white;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      min-width: 150px;
      padding: 8px 0;
    }

    button {
      width: 100%;
      text-align: left;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 14px;
    }

    button:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }

    mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class ContextMenuComponent {
  @Output() duplicate = new EventEmitter<void>();
  @Output() closeMenu = new EventEmitter<void>();

  onDuplicate(): void {
    this.duplicate.emit();
    this.closeMenu.emit();
  }
} 