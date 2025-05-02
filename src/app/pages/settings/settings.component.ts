import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from '../../auth.service';
import { SettingsService, UserSettings } from '../../services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatExpansionModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  settings: UserSettings;

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private settingsService: SettingsService
  ) {
    this.settings = this.settingsService.getCurrentSettings();
  }

  ngOnInit() {
    this.settingsService.getSettings().subscribe(settings => {
      this.settings = settings;
    });
  }

  async saveSettings() {
    await this.settingsService.saveSettings(this.settings);
  }

  toggleTheme() {
    this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
    if (this.settings.theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    this.saveSettings();
  }

  async exportData() {
    const user = await this.authService.getCurrentUser().toPromise();
    if (!user) return;

    // TODO: データのエクスポート処理を実装
  }

  async importData() {
    const user = await this.authService.getCurrentUser().toPromise();
    if (!user) return;

    // TODO: データのインポート処理を実装
  }
}
