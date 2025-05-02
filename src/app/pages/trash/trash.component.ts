import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../services/task.service';
import { Task } from '../../models/task.model';
import { TaskCardComponent } from '../../components/task-card/task-card.component';

@Component({
  selector: 'app-trash',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    TaskCardComponent
  ],
  templateUrl: './trash.component.html',
  styleUrls: ['./trash.component.css']
})
export class TrashComponent implements OnInit {
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  searchQuery: string = '';

  constructor(private taskService: TaskService) {}

  async ngOnInit() {
    try {
      const tasksObservable = await this.taskService.getDeletedTasks();
      tasksObservable.subscribe((tasks: Task[]) => {
      this.tasks = tasks;
      this.filteredTasks = tasks;
    });
    } catch (error) {
      console.error('削除されたタスクの取得に失敗しました:', error);
    }
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredTasks = this.tasks;
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredTasks = this.tasks.filter(task => {
      return (
        (task.tag?.toLowerCase().includes(query)) ||
        (task.title?.toLowerCase().includes(query)) ||
        (task.content?.toLowerCase().includes(query))
      );
    });
  }

  restoreTask(taskId: string): void {
    this.taskService.restoreTask(taskId)
      .then(() => {
        this.ngOnInit();
      })
      .catch(error => {
        console.error('タスクの復元に失敗しました:', error);
        alert('タスクの復元に失敗しました');
      });
  }

  deleteTask(taskId: string): void {
    if (confirm('このタスクを完全に削除しますか？この操作は取り消せません。')) {
      this.taskService.deleteTask(taskId)
        .then(() => {
          this.ngOnInit();
        })
        .catch(error => {
          console.error('タスクの削除に失敗しました:', error);
          alert('タスクの削除に失敗しました');
        });
    }
  }
}
