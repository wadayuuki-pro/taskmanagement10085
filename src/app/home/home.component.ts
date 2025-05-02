import { inject, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TaskCardComponent } from '../components/task-card/task-card.component';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable, BehaviorSubject, combineLatest, from } from 'rxjs';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { map, tap } from 'rxjs/operators';
import { OverlayService } from '../components/task-input/overlay.service';
import { TaskService } from '../services/task.service';
import { Task } from '../models/task.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule,
     TaskCardComponent, MatIconModule, MatDatepickerModule, MatNativeDateModule,
     MatFormFieldModule, MatInputModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  providers: [MatDatepickerModule]
})
export class HomeComponent implements OnInit{
  expandForm = false;
  searchQuery = '';
  private searchSubject = new BehaviorSubject<string>('');

  private firestore = inject(Firestore);
  constructor(
    private overlayService: OverlayService,
    private taskService: TaskService
  ) {}

  tasks$!: Observable<Task[]>;
  filteredTasks$!: Observable<Task[]>;

  async ngOnInit() {
    const tasksObservable = await this.taskService.getTasks();
    this.tasks$ = tasksObservable;
    
    // タスクと検索クエリを組み合わせてフィルタリング
    this.filteredTasks$ = combineLatest([this.tasks$, this.searchSubject]).pipe(
      map(([tasks, query]) => {
        if (!query) return tasks;
        
        const lowerQuery = query.toLowerCase().trim(); // 前後の空白を削除
        const filteredTasks = tasks.filter(task => {
          // nullチェックを追加
          const title = task.title?.toLowerCase() || '';
          const content = task.content?.toLowerCase() || '';
          const tag = task.tag?.toLowerCase() || '';
          
          // 検索条件を厳密に定義
          const titleMatch = title.includes(lowerQuery);
          const contentMatch = content.includes(lowerQuery);
          const tagMatch = tag.includes(lowerQuery);
          
          return titleMatch || contentMatch || tagMatch;
        });

        console.log('フィルタリング結果:', {
          query: lowerQuery,
          totalTasks: tasks.length,
          filteredCount: filteredTasks.length,
          filteredTasks: filteredTasks
        });

        return filteredTasks;
      })
    );
  }

  onSearch() {
    console.log('検索実行:', this.searchQuery);
    this.searchSubject.next(this.searchQuery);
  }

  openTaskInput() {
    console.log('HomeComponent: 新規タスク作成を開始します');
    this.overlayService.openTaskInput();
  }

  editTask(task: Task) {
    console.log('HomeComponent: タスク編集を開始します', task);
    this.overlayService.openTaskInput(task);
  }

  duplicateTask(task: Task): void {
    console.log('タスクを複製:', task);
    this.overlayService.openTaskInput({
      ...task,
      id: undefined,  // 新規タスクとして作成するためIDは未定義に
      title: `${task.title}（コピー）`
    });
  }

  async deleteTask(task: any) {
    const result = confirm('本当に削除しますか？');

    if(result){
      this.taskService.moveToTrash(task.id)
        .then(() => {
          console.log('タスクをゴミ箱に移動しました');
        })
        .catch(error => {
          console.error('タスクの削除に失敗しました:', error);
          alert('タスクの削除に失敗しました');
        });
    }else{
      console.log('削除をキャンセルしました');
    }
  }

  async archiveTask(task: any) {
    this.taskService.archiveTask(task.id)
      .then(() => {
        console.log('タスクをアーカイブしました');
      })
      .catch(error => {
        console.error('タスクのアーカイブに失敗しました:', error);
        alert('タスクのアーカイブに失敗しました');
      });
  }
}
