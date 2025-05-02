import { Injectable, OnDestroy } from '@angular/core';
import { TaskService } from './task.service';
import { interval, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AutoDeleteService implements OnDestroy {
  private autoDeleteSubscription: Subscription | null = null;
  
  constructor(private taskService: TaskService) {}
  
  startAutoDelete(): void {
    // 1時間ごとに自動削除をチェック
    this.autoDeleteSubscription = interval(60 * 60 * 1000).subscribe(() => {
      this.runAutoDelete();
    });
    
    // 初回実行
    this.runAutoDelete();
  }
  
  private runAutoDelete(): void {
    this.taskService.autoDeleteOldTasks()
      .catch(error => {
        console.error('自動削除の実行中にエラーが発生しました:', error);
        // エラーが発生しても処理を継続
      });
  }
  
  ngOnDestroy(): void {
    if (this.autoDeleteSubscription) {
      this.autoDeleteSubscription.unsubscribe();
    }
  }
} 