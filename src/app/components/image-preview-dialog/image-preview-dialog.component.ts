import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-image-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="image-preview-dialog">
      <div class="image-container">
        <img [src]="data.imageUrl" alt="タスク画像" />
      </div>
      <div class="dialog-actions">
        <button mat-button (click)="close()">閉じる</button>
      </div>
    </div>
  `,
  styles: [`
    .image-preview-dialog {
      padding: 16px;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .image-container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    img {
      max-width: 100%;
      max-height: calc(90vh - 64px);
      object-fit: contain;
      border-radius: 4px;
    }
    .dialog-actions {
      margin-top: 16px;
      width: 100%;
      display: flex;
      justify-content: center;
    }
  `]
})
export class ImagePreviewDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ImagePreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { imageUrl: string }
  ) {}

  close(): void {
    this.dialogRef.close();
  }
} 