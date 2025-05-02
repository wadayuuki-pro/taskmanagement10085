import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { inject } from '@angular/core';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { Router } from '@angular/router';
import { fromEventPattern, Observable } from 'rxjs';
import { User } from 'firebase/auth';
import { AutoDeleteService } from './services/auto-delete.service';
import { TutorialComponent } from './components/tutorial/tutorial.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule, CommonModule, SidebarComponent, TutorialComponent],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  private auth = inject(Auth);
  userId: string | null = null;

  user$!: Observable<User | null>;

  constructor(
    private router: Router,
    private autoDeleteService: AutoDeleteService
  ) {
    console.log('AppComponent constructor called');
    
    this.user$ = fromEventPattern<User | null>(
      (handler) => onAuthStateChanged(this.auth, handler),
      (handler) => {}
    );

    onAuthStateChanged(this.auth, (user) => {
      console.log('AppComponent: Auth state changed:', user ? 'User logged in' : 'No user');
      
      if (user) {
        this.userId = user.uid;
        console.log('AppComponent: User ID set to:', this.userId);
      } else {
        this.userId = null;
        console.log('AppComponent: User ID cleared');
      }    
    });
  }

  ngOnInit(): void {
    console.log('AppComponent ngOnInit called');
    
    // 自動削除サービスを開始
    this.autoDeleteService.startAutoDelete();
  }

  shouldShowSidebar(): boolean {
    const noSidebarRoutes = ['/sign-in', '/sign-up'];
    return !noSidebarRoutes.includes(this.router.url);
  }
}
