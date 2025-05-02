import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TaskCardComponent } from '../../components/task-card/task-card.component';
import { TaskService } from '../../services/task.service';
import { Task } from '../../models/task.model';
import { Observable } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, TaskCardComponent],
  templateUrl: './reminders.component.html',
  styleUrls: ['./reminders.component.css']
})
export class RemindersComponent implements OnInit {
  tasks$!: Observable<Task[]>;

  constructor(private taskService: TaskService) {}

  async ngOnInit() {
    try {
      const tasksObservable = await this.taskService.getTasksWithDueDate();
      this.tasks$ = tasksObservable;
    } catch (error) {
      console.error('タスクの取得に失敗しました:', error);
    }
  }

  async refreshTasks() {
    try {
      const tasksObservable = await this.taskService.getTasksWithDueDate();
      this.tasks$ = tasksObservable;
    } catch (error) {
      console.error('タスクの取得に失敗しました:', error);
    }
  }

  archiveTask(taskId: string): void {
    this.taskService.archiveTask(taskId)
      .then(() => {
        console.log('タスクをアーカイブしました');
      })
      .catch(error => {
        console.error('タスクのアーカイブに失敗しました:', error);
      });
  }

  deleteTask(taskId: string): void {
    this.taskService.moveToTrash(taskId)
      .then(() => {
        console.log('タスクを削除しました');
      })
      .catch(error => {
        console.error('タスクの削除に失敗しました:', error);
      });
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate) return false;
    
    const dueDate = task.dueDate instanceof Date 
      ? task.dueDate 
      : task.dueDate instanceof Timestamp 
        ? task.dueDate.toDate() 
        : new Date(task.dueDate);
    const today = new Date();
    
    // 日付部分のみを比較（時刻は無視）
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    return dueDate < today;
  }
}
