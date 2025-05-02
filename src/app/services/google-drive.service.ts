import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GoogleAuthService } from './google-auth.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GoogleDriveService {
  private readonly API_URL = 'https://www.googleapis.com/drive/v3';
  private readonly API_KEY = environment.googleDrive.apiKey;

  constructor(
    private http: HttpClient,
    private googleAuthService: GoogleAuthService
  ) {}

  async uploadFile(file: File, taskId: string): Promise<string> {
    const accessToken = this.googleAuthService.getAccessToken();
  
    if (!accessToken) {
      this.googleAuthService.requestAccessToken();
      throw new Error('アクセストークンを取得するために認証が必要です。もう一度お試しください。');
    }
  
    const metadata = {
      name: `${taskId}_${file.name}`,
      mimeType: file.type
    };
  
    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
  
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
  
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
  
        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${file.type}\r\n` +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          base64Data +
          closeDelimiter;
  
        try {
          console.log('ファイルアップロードを開始します...');
          const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartRequestBody
          });
  
          if (!response.ok) {
            const errorText = await response.text();
            console.error('アップロードエラー詳細:', errorText);
            throw new Error(`ファイルのアップロードに失敗しました: ${response.status} - ${errorText}`);
          }
  
          const result = await response.json();
          console.log('ファイルアップロード成功:', result);
          
          await this.makeFilePublic(result.id, accessToken);
          console.log('ファイルの共有設定を完了しました');
          
          // シンプルな形式のURLを生成
          const imageUrl = `https://drive.google.com/uc?id=${result.id}`;
          console.log('生成された画像URL:', imageUrl);
          resolve(imageUrl);
        } catch (err) {
          console.error('ファイルのアップロード処理中にエラーが発生しました:', err);
          reject(err);
        }
      };
  
      reader.onerror = (err) => {
        console.error('ファイル読み込み失敗:', err);
        reject(err);
      };
  
      reader.readAsDataURL(file);
    });
  }
  
  private async makeFilePublic(fileId: string, accessToken: string): Promise<void> {
    try {
      console.log('ファイルの共有設定を開始します...');

      // 共有設定を変更
      const response = await fetch(`${this.API_URL}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
          allowFileDiscovery: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('共有設定エラー詳細:', errorText);
        throw new Error(`ファイルの共有設定に失敗しました: ${response.status} ${response.statusText}`);
      }

      console.log('ファイルの共有設定が完了しました');
    } catch (error) {
      console.error('共有設定中にエラーが発生しました:', error);
      throw error;
    }
  }

  // 画像URLを取得するメソッド
  async getImageUrl(fileId: string): Promise<string> {
    return `https://drive.google.com/uc?id=${fileId}`;
  }

  // ファイルのダウンロードURLを取得
  private async getDownloadUrl(fileId: string, accessToken: string): Promise<string> {
    try {
      const response = await fetch(`${this.API_URL}/files/${fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('ダウンロードURLの取得に失敗しました');
      }

      return response.url;
    } catch (error) {
      console.error('ダウンロードURLの取得に失敗しました:', error);
      throw error;
    }
  }
}
 