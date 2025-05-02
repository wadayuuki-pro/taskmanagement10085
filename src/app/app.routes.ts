import { Routes } from '@angular/router';
import { SignUpComponent } from './sign-up/sign-up.component';
import { SignInComponent } from './sign-in/sign-in.component';
import { HomeComponent } from './home/home.component';
import { RemindersComponent } from './pages/reminders/reminders.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ArchiveComponent } from './pages/archive/archive.component';
import { TrashComponent } from './pages/trash/trash.component';
import { TagPageComponent } from './tag-page/tag-page.component';
import { CalendarSyncComponent } from './components/calendar-sync/calendar-sync.component';

export const routes: Routes = [
  { path: 'sign-up', component: SignUpComponent },
  { path: 'sign-in', component: SignInComponent },
  { path: 'home', component: HomeComponent },
  { path: 'reminder', component: RemindersComponent },
  { path: 'tag/:tagName', component: TagPageComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'archive', component: ArchiveComponent },
  { path: 'trash', component: TrashComponent },
  { path: 'calendar-sync', component: CalendarSyncComponent, title: 'カレンダー同期' },
  { path: '', redirectTo: '/sign-in', pathMatch: 'full' },
  { path: '**', redirectTo: '/sign-in' }
];

