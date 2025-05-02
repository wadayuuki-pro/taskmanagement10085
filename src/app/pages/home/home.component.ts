import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  template: `
    <div class="home-content">
      <h1>タスク管理アプリへようこそ</h1>
      <p>左側のサイドバーからタグを作成し、タスクを管理できます。</p>
    </div>
  `,
  styles: [`
    .home-content {
      padding: 20px;
    }
  `]
})
export class HomeComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    console.log('HomeComponent constructor called');
  }

  ngOnInit() {
    console.log('HomeComponent ngOnInit called');
    
    // ユーザーがログインしているか確認
    this.authService.getCurrentUser().subscribe(user => {
      console.log('HomeComponent: Auth state changed:', user ? 'User logged in' : 'No user');
      
      if (!user) {
        console.log('HomeComponent: No user logged in, redirecting to sign-in');
        // ユーザーがログインしていない場合はログインページにリダイレクト
        this.router.navigate(['/sign-in']);
      } else {
        console.log('HomeComponent: User logged in, checking tutorial status');
        // チュートリアルの表示状態をリセット（デバッグ用）
        // localStorage.removeItem('tutorialCompleted');
      }
    });
  }
} 