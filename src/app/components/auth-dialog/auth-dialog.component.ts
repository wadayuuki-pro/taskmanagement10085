import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Google認証が必要です</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="closeDialog()">閉じる</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      padding: 20px;
    }
  `]
})
export class AuthDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<AuthDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: string }
  ) {}

  closeDialog(): void {
    this.dialogRef.close();
  }
} 