import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NetworkStatusService } from '../../services/network-status.service';
import { OfflineSyncService } from '../../services/offline-sync.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-network-status',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="network-status" *ngIf="isOffline$ | async">
      <mat-icon>cloud_off</mat-icon>
      <span>オフライン</span>
      <span *ngIf="pendingItemsCount > 0" class="pending-count">
        {{ pendingItemsCount }}件の同期待ち
      </span>
    </div>
    <div class="network-status online" *ngIf="isOnline$ | async">
      <mat-icon>cloud_done</mat-icon>
      <span>オンライン</span>
      <span *ngIf="isSyncing$ | async" class="syncing">
        同期中...
      </span>
    </div>
  `,
  styles: [`
    .network-status {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      font-size: 14px;
      background-color: #f44336;
      color: white;
      width: 100%;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .network-status.online {
      background-color: #4caf50;
    }

    .network-status mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 8px;
    }

    .pending-count, .syncing {
      margin-left: 8px;
      font-weight: 500;
      font-size: 12px;
    }

    @media (max-width: 768px) {
      .network-status {
        position: fixed;
        bottom: 0;
        left: 0;
        z-index: 1000;
        padding: 8px 16px;
      }
    }
  `]
})
export class NetworkStatusComponent implements OnInit {
  isOnline$: Observable<boolean>;
  isOffline$: Observable<boolean>;
  isSyncing$: Observable<boolean>;
  pendingItemsCount = 0;

  constructor(
    private networkStatus: NetworkStatusService,
    private offlineSync: OfflineSyncService
  ) {
    this.isOnline$ = this.networkStatus.isOnline();
    this.isOffline$ = this.networkStatus.isOffline();
    this.isSyncing$ = this.offlineSync.isSyncing();
  }

  ngOnInit(): void {
    // 同期待ちアイテム数を更新
    this.offlineSync.getSyncStatus().subscribe(status => {
      if (status.includes('件の同期待ちアイテム')) {
        const match = status.match(/(\d+)件の同期待ちアイテム/);
        if (match && match[1]) {
          this.pendingItemsCount = parseInt(match[1], 10);
        }
      }
    });
  }
} 