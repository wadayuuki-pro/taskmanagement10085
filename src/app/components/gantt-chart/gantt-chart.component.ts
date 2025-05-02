import { Component, Input, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Timestamp } from '@angular/fire/firestore';

declare let gantt: any;

@Component({
  selector: 'app-gantt-chart',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
  ],
  template: `
    <div class="gantt-container">
      <div class="gantt-header">
        <h3 class="gantt-title">「{{tagName}}」のガントチャート</h3>
        <div class="gantt-legend">
          <div class="legend-item">
            <span class="legend-color status-not-started"></span>
            <span class="legend-label">未着手</span>
          </div>
          <div class="legend-item">
            <span class="legend-color status-in-progress"></span>
            <span class="legend-label">進行中</span>
          </div>
          <div class="legend-item">
            <span class="legend-color status-completed"></span>
            <span class="legend-label">完了</span>
          </div>
        </div>
        <button mat-icon-button class="close-button" (click)="closeGantt()" matTooltip="閉じる">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="gantt-wrapper">
        <div #ganttChart class="gantt-chart"></div>
      </div>
    </div>
  `,
  styles: [`
    .gantt-container {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      width: 100%;
      height: calc(100vh - 200px);
      min-height: 400px;
      min-width: 1050px;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }

    .gantt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      gap: 16px;
    }

    .gantt-title {
      margin: 0;
      font-size: 1.1rem;
      color: #666;
      font-weight: normal;
      white-space: nowrap;
    }

    .gantt-legend {
      display: flex;
      gap: 16px;
      margin-left: auto;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      color: #666;
      white-space: nowrap;
    }

    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 3px;
    }

    .legend-color.status-not-started {
      background-color: #ff6b6b;  /* 明るい赤 */
    }

    .legend-color.status-in-progress {
      background-color: #4dabf7;  /* 明るい青 */
    }

    .legend-color.status-completed {
      background-color: #51cf66;  /* 明るい緑 */
    }

    .close-button {
      color: #666;
    }

    .gantt-wrapper {
      flex: 1;
      position: relative;
      width: 100%;
    }

    .gantt-chart {
      height: 100%;
      width: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }

    :host ::ng-deep .gantt_task_line {
      border-radius: 4px;
      border: none;
    }

    :host ::ng-deep .gantt_task_line.status_not_started {
      background-color: #ff6b6b;  /* 明るい赤 */
    }

    :host ::ng-deep .gantt_task_line.status_in_progress {
      background-color: #4dabf7;  /* 明るい青 */
    }

    :host ::ng-deep .gantt_task_line.status_completed {
      background-color: #51cf66;  /* 明るい緑 */
    }

    :host ::ng-deep .gantt_task_line.high_priority {
      border-top: 3px solid #ff4d4d;
    }

    :host ::ng-deep .gantt_task_line.medium_priority {
      border-top: 3px solid #ffa64d;
    }

    :host ::ng-deep .gantt_task_line.low_priority {
      border-top: 3px solid #4da6ff;
    }

    :host ::ng-deep .gantt_task_line.status_not_started .gantt_task_progress {
      background-color: rgba(255, 107, 107, 0.4); /* #ff6b6b の半透明版 */
    }

    :host ::ng-deep .gantt_task_line.status_in_progress .gantt_task_progress {
      background-color: rgba(77, 171, 247, 0.4); /* #4dabf7 の半透明版 */
    }

    :host ::ng-deep .gantt_task_line.status_completed .gantt_task_progress {
      background-color: rgba(81, 207, 102, 0.4); /* #51cf66 の半透明版 */
    }

    :host ::ng-deep .gantt_grid_scale,
    :host ::ng-deep .gantt_task_scale {
      color: #666;
      font-size: 12px;
      background-color: #f5f5f5;
    }

    :host ::ng-deep .gantt_grid_data {
      background-color: white;
    }

    :host ::ng-deep .gantt_row {
      border-bottom: 1px solid #eee;
    }

    :host ::ng-deep .gantt_cell {
      border-right: 1px solid #eee;
    }

    :host ::ng-deep .gantt_grid_scale .gantt_grid_head_cell {
      border-right: 1px solid #eee;
    }

    :host ::ng-deep .gantt_grid_data .gantt_cell {
      padding: 8px;
    }

    :host ::ng-deep .gantt_task_progress {
      background-color: rgba(0,0,0,0.2);
    }

    :host ::ng-deep .gantt_grid {
      border-right: 1px solid #eee;
    }

    :host ::ng-deep .gantt_layout_content {
      vertical-align: top;
    }

    :host ::ng-deep .gantt_scale_line {
      border-top: 1px solid #eee;
    }

    :host ::ng-deep .gantt_task_cell {
      min-width: 100px !important;
    }
  `]
})
export class GanttChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() tasks: Task[] = [];
  @Input() tagName: string = '';
  @Output() close = new EventEmitter<void>();
  @ViewChild('ganttChart') ganttChartElement!: ElementRef;
  private isGanttInitialized = false;

  ngOnInit() {
    this.initGantt();
  }

  private initGantt() {
    const waitForGantt = () => {
      if (typeof gantt !== 'undefined') {
        this.configureGantt();
      } else {
        setTimeout(waitForGantt, 100);
      }
    };
    waitForGantt();
  }

  private configureGantt() {
    try {
      // 基本設定
      gantt.config.date_format = "%Y-%m-%d";
      gantt.config.scale_height = 50;
      gantt.config.row_height = 45;
      gantt.config.task_height = 30;
      gantt.config.min_column_width = 35;

      // 表示範囲の制御
      gantt.config.fit_tasks = true;
      gantt.config.smart_rendering = true;
      gantt.config.show_tasks_outside_timescale = false;
      
      // レイアウト設定
      gantt.config.layout = {
        css: "gantt_container",
        rows: [
          {
            cols: [
              {
                view: "grid",
                width: 320,
                scrollX: "scrollHor",
                scrollY: "scrollVer"
              },
              {
                view: "timeline",
                scrollX: "scrollHor",
                scrollY: "scrollVer",
                width: 800
              },
              { view: "scrollbar", id: "scrollVer" }
            ]
          },
          { view: "scrollbar", id: "scrollHor", height: 20 }
        ]
      };

      // スケールの設定
      gantt.config.scales = [
        { 
          unit: "month", 
          step: 1, 
          format: "%M",
          css: function(date: Date) {
            return "gantt_scale_month";
          }
        },
        { 
          unit: "day", 
          step: 1, 
          format: "%j",
          css: function(date: Date) {
            const day = date.getDay();
            return day === 0 ? "weekend" : day === 6 ? "weekend" : "";
          }
        }
      ];

      // 土日の背景色を設定
      gantt.templates.timeline_cell_class = function(task: any, date: Date) {
        const day = date.getDay();
        return day === 0 || day === 6 ? "weekend" : "";
      };

      // スタイルを追加
      const style = document.createElement('style');
      style.innerHTML = `
        .weekend {
          background-color: #f8f8f8 !important;
        }
      `;
      document.head.appendChild(style);

      // タスクのスタイリング
      gantt.templates.task_class = function(start: Date, end: Date, task: any) {
        switch (task.status) {
          case '未着手':
            return 'status_not_started';
          case '進行中':
            return 'status_in_progress';
          case '完了':
            return 'status_completed';
          default:
            return 'status_not_started';
        }
      };

      // 列の設定
      gantt.config.columns = [
        { name: "text", label: "タスク名", width: 120, tree: true },
        { 
          name: "assignee", 
          label: "担当者", 
          width: 120,
          align: "center",
          template: function(task: any) {
            return task.assignee || "-";
          }
        },
        { 
          name: "status", 
          label: "状態", 
          width: 40,
          align: "center",
          template: function(task: any) {
            const statuses: { [key: string]: string } = {
              status_not_started: "未",
              status_in_progress: "進",
              status_completed: "完"
            };
            const cssClass = task.css.split(' ')[0];
            return statuses[cssClass] || "未";
          }
        },
        { 
          name: "priority", 
          label: "優先", 
          width: 40,
          align: "center",
          template: function(task: any) {
            const priorities: { [key: string]: string } = {
              high: "高",
              medium: "中",
              low: "低"
            };
            return priorities[task.priority] || "中";
          }
        }
      ];

      // セルのスタイルを調整
      const additionalStyle = document.createElement('style');
      additionalStyle.innerHTML = `
        .gantt_grid_data .gantt_cell {
          line-height: 40px;
          white-space: normal;
          padding: 10px 8px;
        }
        .gantt_tree_content {
          line-height: 1.4;
          padding: 5px 0;
        }
      `;
      document.head.appendChild(additionalStyle);

      // 日本語化
      gantt.i18n.setLocale({
        date: {
          month_full: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
          month_short: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
          day_full: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"],
          day_short: ["日", "月", "火", "水", "木", "金", "土"]
        },
        labels: {
          new_task: "新規タスク",
          time_period: "期間",
          section_description: "説明",
          section_time: "期間",
          section_priority: "優先度"
        }
      });

      this.isGanttInitialized = true;
    } catch (error) {
      console.error('ガントチャートの初期化中にエラーが発生しました:', error);
    }
  }

  ngAfterViewInit() {
    const initializeGantt = () => {
      if (this.isGanttInitialized && this.ganttChartElement) {
        try {
          gantt.init(this.ganttChartElement.nativeElement);
          this.loadTasks();
        } catch (error) {
          console.error('ガントチャートの初期化中にエラーが発生しました:', error);
        }
      } else {
        setTimeout(initializeGantt, 100);
      }
    };
    initializeGantt();
  }

  loadTasks() {
    if (!this.tasks || this.tasks.length === 0) {
      try {
        gantt.message({ text: "表示できるタスクがありません。", type: "error" });
      } catch (error) {
        console.error('メッセージ表示中にエラーが発生しました:', error);
      }
      return;
    }

    try {
      // タスクの開始日と終了日を取得して表示範囲を決定
      const validTasks = this.tasks.filter(task => task.startDate && task.dueDate);
      if (validTasks.length === 0) {
        gantt.message({ text: "開始日と終了日が設定されたタスクがありません。", type: "warning" });
        return;
      }

      const dates = validTasks.map(task => ({
        start: this.convertToDate(task.startDate),
        end: this.convertToDate(task.dueDate)
      }));

      // 全タスクの中で最も早い開始日と最も遅い終了日を取得
      const minDate = new Date(Math.min(...dates.map(d => d.start.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.end.getTime())));

      // 表示範囲を設定（前後1週間ずつ余裕を持たせる）
      const startDate = new Date(minDate);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(maxDate);
      endDate.setDate(endDate.getDate() + 7);

      // タスクデータの作成
      const ganttTasks = validTasks.map(task => {
        const startDate = this.convertToDate(task.startDate);
        const dueDate = this.convertToDate(task.dueDate);
        const duration = Math.max(1, Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24))) + 1;

        // ステータスに基づくCSSクラスを設定
        let statusClass = '';
        switch (task.status) {
          case '未着手':
            statusClass = 'status_not_started';
            break;
          case '進行中':
            statusClass = 'status_in_progress';
            break;
          case '完了':
            statusClass = 'status_completed';
            break;
          default:
            statusClass = 'status_not_started';
        }

        // 担当者情報の取得
        let assignee = "-";
        if (task.assignedUser) {
          assignee = task.assignedUser;
        } else if (task.assignedUsers && task.assignedUsers.length > 0) {
          if (task.assignedUsers.length === 1) {
            assignee = task.assignedUsers[0].displayName || task.assignedUsers[0].email;
          } else {
            const firstAssignee = task.assignedUsers[0].displayName || task.assignedUsers[0].email;
            assignee = `${firstAssignee}他${task.assignedUsers.length - 1}名`;
          }
        }

        return {
          id: task.id,
          text: task.title,
          start_date: startDate,
          duration: duration,
          priority: task.priority || 'medium',
          status: task.status || '未着手',
          css: statusClass,
          progress: task.status === '完了' ? 1 : task.status === '進行中' ? 0.5 : 0,
          assignee: assignee
        };
      });

      // ガントチャートの更新
      gantt.config.start_date = startDate;
      gantt.config.end_date = endDate;
      
      gantt.clearAll();
      gantt.parse({ data: ganttTasks });
      
      // スケールの調整
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
      const timelineWidth = Math.max(800, totalDays * 35);
      const minColumnWidth = Math.max(35, Math.floor(timelineWidth / totalDays));
      
      gantt.config.min_column_width = minColumnWidth;
      gantt.render();

    } catch (error) {
      console.error('タスクの読み込み中にエラーが発生しました:', error);
    }
  }

  convertToDate(date: any): Date {
    if (date instanceof Timestamp) {
      return date.toDate();
    } else if (date instanceof Date) {
      return date;
    } else if (date && date.toDate) {
      return date.toDate();
    } else if (date) {
      return new Date(date);
    }
    return new Date();
  }

  closeGantt() {
    if (this.isGanttInitialized) {
      try {
        gantt.clearAll();
      } catch (error) {
        console.error('ガントチャートのクリーンアップ中にエラーが発生しました:', error);
      }
    }
    this.close.emit();
  }

  ngOnDestroy() {
    if (this.isGanttInitialized) {
      try {
        gantt.clearAll();
      } catch (error) {
        console.error('ガントチャートのクリーンアップ中にエラーが発生しました:', error);
      }
    }
  }
} 