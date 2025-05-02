import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  private tokenClient: any;
  private accessTokenSubject = new BehaviorSubject<string | null>(null);
  public accessToken$ = this.accessTokenSubject.asObservable();
  private isInitialized = false;

  constructor() {
    this.initializeGoogleApi();
  }

  private initializeGoogleApi() {
    console.log('Google APIの初期化を開始します');
    
    // 既にスクリプトが読み込まれているか確認
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      console.log('Google APIスクリプトは既に読み込まれています');
      this.setupTokenClient();
      return;
    }
    
    // Google APIクライアントライブラリの読み込み
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('Google APIスクリプトが読み込まれました');
      this.setupTokenClient();
    };
    
    script.onerror = (error) => {
      console.error('Google APIスクリプトの読み込みに失敗しました:', error);
    };
    
    document.head.appendChild(script);
  }
  
  private setupTokenClient() {
    try {
      console.log('トークンクライアントの設定を開始します');
      console.log('クライアントID:', environment.googleDrive.clientId);
      console.log('スコープ:', environment.googleDrive.scope);
      
      // @ts-ignore
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        console.error('Google APIが正しく読み込まれていません');
        return;
      }
      
      // @ts-ignore
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: environment.googleDrive.clientId,
        scope: environment.googleDrive.scope,
        prompt: 'consent',
        redirect_uri: window.location.origin,
        callback: (response: any) => {
          console.log('認証コールバックが呼び出されました:', response);
          
          if (response.error) {
            console.error('認証エラー:', response.error);
            return;
          }
          
          if (response.access_token) {
            console.log('アクセストークンを取得しました');
            this.accessTokenSubject.next(response.access_token);
          } else {
            console.error('アクセストークンの取得に失敗しました:', response);
          }
        },
      });
      
      this.isInitialized = true;
      console.log('トークンクライアントの設定が完了しました');
    } catch (error) {
      console.error('トークンクライアントの設定中にエラーが発生しました:', error);
    }
  }

  public requestAccessToken() {
    console.log('アクセストークンのリクエストを開始します');
    
    if (!this.isInitialized) {
      console.log('トークンクライアントが初期化されていないため、再初期化します');
      this.initializeGoogleApi();
      
      // 初期化が完了するまで少し待つ
      setTimeout(() => {
        this.requestAccessToken();
      }, 1000);
      return;
    }
    
    if (this.tokenClient) {
      console.log('トークンクライアントを使用してアクセストークンをリクエストします');
      try {
        // 常にリダイレクト認証を使用
        this.tokenClient.requestAccessToken({
          prompt: 'consent',
          redirect_uri: window.location.origin,
          ux_mode: 'redirect'
        });
      } catch (error) {
        console.error('アクセストークンのリクエスト中にエラーが発生しました:', error);
      }
    } else {
      console.error('Google APIクライアントが初期化されていません');
    }
  }

  public getAccessToken(): string | null {
    const token = this.accessTokenSubject.value;
    console.log('現在のアクセストークン:', token ? `${token.substring(0, 10)}...` : 'なし');
    return token;
  }
} 