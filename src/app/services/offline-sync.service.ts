import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where } from '@angular/fire/firestore';
import { NetworkStatusService } from './network-status.service';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';

export interface SyncItem {
  id?: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  data?: any;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private syncQueue: SyncItem[] = [];
  private syncInProgress = new BehaviorSubject<boolean>(false);
  private syncStatus = new BehaviorSubject<string>('');

  constructor(
    private firestore: Firestore,
    private networkStatus: NetworkStatusService
  ) {
    // ネットワーク状態の変更を監視
    this.networkStatus.isOnline().subscribe(online => {
      if (online) {
        this.processSyncQueue();
      }
    });

    // ローカルストレージから同期キューを読み込む
    this.loadSyncQueue();
  }

  // 同期キューにアイテムを追加
  addToSyncQueue(item: SyncItem): void {
    this.syncQueue.push(item);
    this.saveSyncQueue();
    this.syncStatus.next(`${this.syncQueue.length}件の同期待ちアイテムがあります`);
  }

  // 同期キューを処理
  private processSyncQueue(): void {
    if (this.syncQueue.length === 0 || this.syncInProgress.value) {
      return;
    }

    this.syncInProgress.next(true);
    this.syncStatus.next('同期を開始します...');

    const item = this.syncQueue[0];

    this.processSyncItem(item).subscribe(
      success => {
        if (success) {
          this.syncQueue.shift();
          this.saveSyncQueue();
          this.syncStatus.next(`${this.syncQueue.length}件の同期待ちアイテムが残っています`);
        } else {
          this.syncStatus.next('同期に失敗しました。後で再試行します。');
        }
        this.syncInProgress.next(false);
        this.processSyncQueue();
      },
      error => {
        console.error('同期エラー:', error);
        this.syncStatus.next('同期エラーが発生しました。後で再試行します。');
        this.syncInProgress.next(false);
        this.processSyncQueue();
      }
    );
  }

  // 同期アイテムを処理
  private processSyncItem(item: SyncItem): Observable<boolean> {
    switch (item.type) {
      case 'create':
        return from(addDoc(collection(this.firestore, item.collection), item.data)).pipe(
          map(() => true),
          tap(() => this.syncStatus.next('アイテムを作成しました'))
        );
      case 'update':
        if (!item.id) return of(false);
        return from(updateDoc(doc(this.firestore, item.collection, item.id), item.data)).pipe(
          map(() => true),
          tap(() => this.syncStatus.next('アイテムを更新しました'))
        );
      case 'delete':
        if (!item.id) return of(false);
        return from(deleteDoc(doc(this.firestore, item.collection, item.id))).pipe(
          map(() => true),
          tap(() => this.syncStatus.next('アイテムを削除しました'))
        );
      default:
        return of(false);
    }
  }

  // 同期キューをローカルストレージに保存
  private saveSyncQueue(): void {
    localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
  }

  // 同期キューをローカルストレージから読み込む
  private loadSyncQueue(): void {
    const savedQueue = localStorage.getItem('syncQueue');
    if (savedQueue) {
      this.syncQueue = JSON.parse(savedQueue);
      if (this.syncQueue.length > 0) {
        this.syncStatus.next(`${this.syncQueue.length}件の同期待ちアイテムがあります`);
      }
    }
  }

  // 同期状態を取得
  getSyncStatus(): Observable<string> {
    return this.syncStatus.asObservable();
  }

  // 同期中かどうかを取得
  isSyncing(): Observable<boolean> {
    return this.syncInProgress.asObservable();
  }

  // 同期待ちアイテム数を取得
  getPendingItemsCount(): number {
    return this.syncQueue.length;
  }
} 