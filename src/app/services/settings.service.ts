import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { AuthService } from '../auth.service';

export interface UserSettings {
  theme: 'light' | 'dark';
  calendarNotificationTime: '5' | '10' | '15' | '30' | '60' | '120' | '1440';
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private settings = new BehaviorSubject<UserSettings>({
    theme: 'light',
    calendarNotificationTime: '10'
  });

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {
    this.loadSettings();
  }

  getSettings(): Observable<UserSettings> {
    return this.settings.asObservable();
  }

  getCurrentSettings(): UserSettings {
    return this.settings.getValue();
  }

  async loadSettings() {
    const user = await this.authService.getCurrentUser().toPromise();
    if (!user) return;

    try {
      const settingsDoc = await getDoc(doc(this.firestore, `users/${user.uid}/settings/preferences`));
      if (settingsDoc.exists()) {
        this.settings.next({ ...this.settings.getValue(), ...settingsDoc.data() as UserSettings });
      }
    } catch (error) {
      console.error('設定の読み込みに失敗しました:', error);
    }
  }

  async saveSettings(newSettings: Partial<UserSettings>) {
    const user = await this.authService.getCurrentUser().toPromise();
    if (!user) return;

    try {
      const updatedSettings = { ...this.settings.getValue(), ...newSettings };
      await setDoc(doc(this.firestore, `users/${user.uid}/settings/preferences`), updatedSettings);
      this.settings.next(updatedSettings);
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
    }
  }

  getCalendarNotificationMinutes(): number {
    const settings = this.settings.getValue();
    return parseInt(settings.calendarNotificationTime);
  }
} 