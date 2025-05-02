import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NetworkStatusService {
  private online = new BehaviorSubject<boolean>(navigator.onLine);
  private offline = new BehaviorSubject<boolean>(!navigator.onLine);

  constructor() {
    window.addEventListener('online', () => {
      this.online.next(true);
      this.offline.next(false);
    });

    window.addEventListener('offline', () => {
      this.online.next(false);
      this.offline.next(true);
    });
  }

  isOnline(): Observable<boolean> {
    return this.online.asObservable();
  }

  isOffline(): Observable<boolean> {
    return this.offline.asObservable();
  }

  getCurrentStatus(): boolean {
    return navigator.onLine;
  }
} 