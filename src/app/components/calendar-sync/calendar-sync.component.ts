import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { CalendarService } from '../../services/calendar.service';
import { TaskService } from '../../services/task.service';
import { SettingsService } from '../../services/settings.service';
import { Task } from '../../models/task.model';
import { NgZone } from '@angular/core';

@Component({
  selector: 'app-calendar-sync',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    FormsModule
  ],
  template: `
    <div class="calendar-sync-container">
      <mat-card class="sync-card">
        <mat-card-header>
          <mat-card-title class="sync-title">Googleカレンダー同期</mat-card-title>
          <mat-card-subtitle class="sync-subtitle">タスクをGoogleカレンダーと同期して、スケジュール管理を効率化しましょう</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="sync-status">
            <div *ngIf="isLoading" class="loading-container">
              <mat-spinner diameter="24"></mat-spinner>
              <span class="loading-text">同期中...</span>
            </div>
            <div *ngIf="error" class="error-message">
              <mat-icon>error_outline</mat-icon>
              <span>{{ error }}</span>
            </div>
            <div *ngIf="successMessage" class="success-message">
              <mat-icon>check_circle</mat-icon>
              <span>{{ successMessage }}</span>
            </div>
          </div>
          <div class="sync-actions">
            <button mat-raised-button color="primary" 
                    (click)="syncWithGoogleCalendar()"
                    [disabled]="isLoading"
                    class="sync-button">
              <mat-icon>sync</mat-icon>
              <span>Googleカレンダーと同期</span>
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .calendar-sync-container {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
      margin-left: 280px;
      margin-top: 64px;
      background-color: #f8f9fa;
      border-radius: 12px;
    }

    .sync-card {
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .sync-title {
      font-size: 1.5rem;
      font-weight: 500;
      color: #1976d2;
      margin-bottom: 8px;
    }

    .sync-subtitle {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 24px;
    }

    .sync-status {
      margin: 20px 0;
    }

    .loading-container {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #1976d2;
    }

    .loading-text {
      font-size: 1rem;
      font-weight: 500;
    }

    .error-message, .success-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-radius: 6px;
      font-size: 0.95rem;
    }

    .error-message {
      color: #f44336;
    }

    .success-message {
      color: #4caf50;
    }

    .sync-actions {
      display: flex;
      justify-content: center;
      margin-top: 20px;
    }

    .sync-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      font-size: 1rem;
      font-weight: 500;
      border-radius: 8px;
      background-color: #4da6ff !important;
      color: white !important;
      transition: all 0.2s ease;
    }

    .sync-button:hover {
      background-color: #1976d2 !important;
      transform: translateY(-1px);
    }

    .sync-button:disabled {
      background-color: #b0bec5 !important;
      transform: none;
      box-shadow: none;
    }

    mat-spinner {
      display: inline-block;
      margin-right: 10px;
    }

    .sync-actions button.mat-raised-button {
      background-color: #4da6ff !important;
      color: white !important;
    }

    .sync-actions button.mat-raised-button:hover {
      background-color: #1976d2 !important;
    }

    .sync-actions button.mat-raised-button:disabled {
      background-color: #b0bec5 !important;
    }

    @media (max-width: 768px) {
      .calendar-sync-container {
        margin-left: 0;
        padding: 16px;
      }

      .sync-title {
        font-size: 1.25rem;
      }

      .sync-subtitle {
        font-size: 0.85rem;
      }

      .sync-button {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class CalendarSyncComponent implements OnInit {
  isLoading = false;
  error: string | null = null;
  successMessage: string | null = null;
  tasks: Task[] = [];
  subscriptions: any[] = [];

  constructor(
    private calendarService: CalendarService,
    private taskService: TaskService,
    private settingsService: SettingsService,
    private ngZone: NgZone
  ) {
    console.log('CalendarSyncComponentが初期化されました');
  }

  async ngOnInit() {
    try {
      const tasksObservable = await this.taskService.getTasks();
      const subscription = tasksObservable.subscribe({
        next: (result: Task[]) => {
          this.tasks = result;
        },
        error: (error: any) => {
          console.error('タスクの取得に失敗しました:', error);
        }
      });
      this.subscriptions.push(subscription);
    } catch (error) {
      console.error('タスクの取得に失敗しました:', error);
    }
  }

  async syncWithGoogleCalendar() {
    console.log('syncWithGoogleCalendarメソッドが呼び出されました');
    this.isLoading = true;
    this.error = null;
    this.successMessage = null;

    try {
      console.log('GoogleカレンダーAPIの初期化を開始します...');
      await this.calendarService.initializeGoogleApi();
      console.log('GoogleカレンダーAPIの初期化が完了しました');
      
      // タスクの取得
      console.log('タスクの取得を開始します...');
      const tasksObservable = await this.taskService.getTasks();
      const tasks = await new Promise<Task[]>((resolve, reject) => {
        this.ngZone.run(() => {
          const subscription = tasksObservable.subscribe({
            next: (result: Task[]) => {
              resolve(result);
              subscription.unsubscribe();
            },
            error: (error: any) => {
              console.error('タスクの取得に失敗しました:', error);
              this.error = 'タスクの取得に失敗しました。もう一度お試しください。';
              subscription.unsubscribe();
              reject(error);
            }
          });
        });
      });
      
      console.log('取得したタスク:', tasks);
      
      if (!tasks || tasks.length === 0) {
        console.warn('タスクが取得できませんでした');
        this.error = '同期するタスクがありません。タスクを作成してから再度お試しください。';
        return;
      }

      const notificationMinutes = this.settingsService.getCalendarNotificationMinutes();
      console.log(`${tasks.length}件のタスクをカレンダーに同期します...`);
      await this.calendarService.syncTasksToCalendar(tasks, notificationMinutes);
      
      this.successMessage = 'Googleカレンダーとの同期が完了しました';
      console.log('同期が完了しました');
    } catch (error) {
      console.error('同期エラー:', error);
      this.error = '同期中にエラーが発生しました。もう一度お試しください。';
    } finally {
      this.isLoading = false;
    }
  }
} 