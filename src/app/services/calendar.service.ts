import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, User } from '@angular/fire/auth';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Task } from '../models/task.model';
import { Timestamp } from '@angular/fire/firestore';

// gapiの型定義
declare var gapi: any;
declare var google: any;

declare global {
  interface Window {
    gapi: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private tokenClient: any;
  private accessToken: string | null = null;
  private readonly CLIENT_ID = environment.googleCalendar.clientId;
  private readonly API_KEY = environment.googleCalendar.apiKey;
  private readonly SCOPES = 'https://www.googleapis.com/auth/calendar';
  private isInitialized = false;
  private isScriptLoaded = false;

  constructor(
    private http: HttpClient,
    private auth: Auth,
    private ngZone: NgZone
  ) {
    this.loadGoogleApiScript();
    this.checkRedirectResult();
  }

  private async checkRedirectResult() {
    try {
      const result = await getRedirectResult(this.auth);
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          this.accessToken = credential.accessToken;
          console.log('Access token obtained from redirect:', this.accessToken);
        }
      }
    } catch (error) {
      console.error('Redirect result error:', error);
    }
  }

  private loadGoogleApiScript() {
    if (this.isScriptLoaded) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      console.log('Google APIスクリプトが読み込まれました');
      this.isScriptLoaded = true;
      this.initializeGoogleApi();
    };
    script.onerror = (error) => {
      console.error('Google APIスクリプトの読み込みに失敗しました:', error);
    };
    document.body.appendChild(script);
  }

  public async initializeGoogleApi() {
    if (this.isInitialized) {
      console.log('Google APIは既に初期化されています');
      return;
    }

    if (!this.isScriptLoaded) {
      console.log('Google APIスクリプトがまだ読み込まれていません。読み込みを待機します...');
      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.isScriptLoaded) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        // 30秒後にタイムアウト
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Google APIスクリプトの読み込みがタイムアウトしました'));
        }, 30000);
      });
    }

    try {
      console.log('Google APIの初期化を開始します...');
      
      // gapiが利用可能か確認
      if (typeof gapi === 'undefined') {
        throw new Error('gapiが定義されていません。スクリプトが正しく読み込まれていない可能性があります。');
      }

      await new Promise((resolve, reject) => {
        gapi.load('client', {
          callback: () => {
            console.log('Google APIクライアントが読み込まれました');
            resolve(null);
          },
          onerror: (error: any) => {
            console.error('Google APIクライアントの読み込みに失敗しました:', error);
            reject(error);
          }
        });
      });

      console.log('Google APIクライアントの初期化を開始します...');
      await gapi.client.init({
        apiKey: this.API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
      });

      console.log('Google APIクライアントの初期化が完了しました。トークンクライアントを設定します...');
      
      // google.accountsが利用可能か確認
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        throw new Error('google.accounts.oauth2が利用できません。認証ライブラリが正しく読み込まれていない可能性があります。');
      }

      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('トークン取得エラー:', tokenResponse.error);
            return;
          }
          this.accessToken = tokenResponse.access_token;
          console.log('アクセストークンを取得しました');
        },
      });

      this.isInitialized = true;
      console.log('Google APIの初期化が完了しました');
    } catch (error) {
      console.error('Google APIの初期化に失敗しました:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.accessToken) {
      return new Promise((resolve, reject) => {
        this.ngZone.runOutsideAngular(() => {
          this.tokenClient.callback = async (resp: any) => {
            if (resp.error !== undefined) {
              reject(resp);
            }
            this.accessToken = resp.access_token;
            if (this.accessToken) {
              resolve(this.accessToken);
            } else {
              reject(new Error('Failed to get access token'));
            }
          };
          this.tokenClient.requestAccessToken({ prompt: '' });
        });
      });
    }
    return this.accessToken;
  }

  public async signInWithGoogle(): Promise<boolean> {
    try {
      console.log('Google認証を開始します...');
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      
      await signInWithRedirect(this.auth, provider);
      console.log('Google認証が成功しました');
      return true;
    } catch (error) {
      console.error('Google認証に失敗しました:', error);
      return false;
    }
  }

  syncWithGoogleCalendar(): Observable<any[]> {
    return from(this.ngZone.runOutsideAngular(async () => {
      try {
        if (!this.accessToken) {
          console.log('No access token, initiating Google sign in...');
          await this.signInWithGoogle();
        }

        console.log('Fetching calendar events...');
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${new Date().toISOString()}&showDeleted=false&singleEvents=true&maxResults=10&orderBy=startTime&key=${this.API_KEY}`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          console.error('Calendar API request failed:', response.status, response.statusText);
          throw new Error('Calendar API request failed');
        }

        const data = await response.json();
        console.log('Calendar events fetched successfully:', data.items?.length, 'events');
        return data.items;
      } catch (error) {
        console.error('Calendar sync error:', error);
        throw error;
      }
    }));
  }

  addEventToGoogleCalendar(event: any): Observable<void> {
    return from(this.ngZone.runOutsideAngular(async () => {
      try {
        if (!this.accessToken) {
          await this.signInWithGoogle();
        }

        console.log('Adding event to calendar:', event);
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?key=${this.API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event)
          }
        );

        if (!response.ok) {
          console.error('Failed to add event:', response.status, response.statusText);
          throw new Error('Failed to add event');
        }

        console.log('Event added successfully');
      } catch (error) {
        console.error('Add event error:', error);
        throw error;
      }
    }));
  }

  updateEventInGoogleCalendar(eventId: string, event: any): Observable<void> {
    return from(this.ngZone.runOutsideAngular(async () => {
      try {
        if (!this.accessToken) {
          await this.signInWithGoogle();
        }

        console.log('Updating event in calendar:', eventId);
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?key=${this.API_KEY}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event)
          }
        );

        if (!response.ok) {
          console.error('Failed to update event:', response.status, response.statusText);
          throw new Error('Failed to update event');
        }

        console.log('Event updated successfully');
      } catch (error) {
        console.error('Update event error:', error);
        throw error;
      }
    }));
  }

  deleteEventFromGoogleCalendar(eventId: string): Observable<void> {
    return from(this.ngZone.runOutsideAngular(async () => {
      try {
        if (!this.accessToken) {
          await this.signInWithGoogle();
        }

        console.log('Deleting event from calendar:', eventId);
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?key=${this.API_KEY}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            }
          }
        );

        if (!response.ok) {
          console.error('Failed to delete event:', response.status, response.statusText);
          throw new Error('Failed to delete event');
        }

        console.log('Event deleted successfully');
      } catch (error) {
        console.error('Delete event error:', error);
        throw error;
      }
    }));
  }

  public async syncTasksToCalendar(tasks: Task[], notificationMinutes: number = 10) {
    try {
      await this.ensureAccessToken();
      
      for (const task of tasks) {
        if (!task.dueDate) continue;

        const dueDate = task.dueDate instanceof Timestamp 
          ? task.dueDate.toDate() 
          : new Date(task.dueDate);

        const startDate = task.startDate instanceof Timestamp
          ? task.startDate.toDate()
          : task.startDate ? new Date(task.startDate) : dueDate;

        const event = {
          summary: task.title,
          description: task.content || '',
          start: {
            dateTime: startDate.toISOString(),
            timeZone: 'Asia/Tokyo'
          },
          end: {
            dateTime: dueDate.toISOString(),
            timeZone: 'Asia/Tokyo'
          },
          reminders: {
            useDefault: false,
            overrides: [
              {
                method: 'popup',
                minutes: notificationMinutes
              }
            ]
          }
        };

        try {
          await gapi.client.calendar.events.insert({
            calendarId: 'primary',
            resource: event
          });
          console.log(`タスク "${task.title}" をカレンダーに追加しました`);
        } catch (error) {
          console.error(`タスク "${task.title}" のカレンダー追加に失敗しました:`, error);
          throw error;
        }
      }
    } catch (error) {
      console.error('カレンダー同期エラー:', error);
      throw error;
    }
  }

  private async requestAccessToken() {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = async (response: any) => {
        if (response.error) {
          console.error('アクセストークンの取得に失敗しました:', response.error);
          reject(response.error);
          return;
        }
        this.accessToken = response.access_token;
        console.log('アクセストークンを取得しました');
        resolve(response);
      };
      console.log('アクセストークンの取得を要求します...');
      this.tokenClient.requestAccessToken();
    });
  }

  public async syncCalendar(): Promise<void> {
    try {
      console.log('カレンダー同期を開始します...');
      const isSignedIn = await this.signInWithGoogle();
      if (!isSignedIn) {
        throw new Error('Google認証に失敗しました');
      }
      // ... existing code ...
    } catch (error) {
      console.error('カレンダー同期に失敗しました:', error);
      throw error;
    }
  }

  public async getCalendarEvents(): Promise<any[]> {
    try {
      console.log('カレンダーイベントの取得を開始します...');
      const isSignedIn = await this.signInWithGoogle();
      if (!isSignedIn) {
        throw new Error('Google認証に失敗しました');
      }
      // ... existing code ...
      return [];
    } catch (error) {
      console.error('カレンダーイベントの取得に失敗しました:', error);
      throw error;
    }
  }

  public async createCalendarEvent(event: any): Promise<void> {
    try {
      console.log('カレンダーイベントの作成を開始します...');
      const isSignedIn = await this.signInWithGoogle();
      if (!isSignedIn) {
        throw new Error('Google認証に失敗しました');
      }
      // ... existing code ...
    } catch (error) {
      console.error('カレンダーイベントの作成に失敗しました:', error);
      throw error;
    }
  }

  public async updateCalendarEvent(eventId: string, event: any): Promise<void> {
    try {
      console.log('カレンダーイベントの更新を開始します...');
      const isSignedIn = await this.signInWithGoogle();
      if (!isSignedIn) {
        throw new Error('Google認証に失敗しました');
      }
      // ... existing code ...
    } catch (error) {
      console.error('カレンダーイベントの更新に失敗しました:', error);
      throw error;
    }
  }
} 