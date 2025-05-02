import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-tutorial',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    FormsModule
  ],
  templateUrl: './tutorial.component.html',
  styleUrls: ['./tutorial.component.css']
})
export class TutorialComponent implements OnInit {
  currentStep = 0;
  hideNextTime = false;
  private userId: string | null = null;
  steps = [
    {
      title: 'タスク管理アプリへようこそ！',
      content: 'このアプリでは、タスクの作成、管理、進捗の追跡が簡単にできます。まずは基本的な使い方を見てみましょう。'
    },
    {
      title: 'タスクの作成',
      content: '右上の「タスクを追加」ボタンをクリックして、新しいタスクを作成できます。プロジェクト名、タイトル、期限、優先度などを設定できます。'
    },
    {
      title: 'タグによる整理',
      content: 'タスク入力画面でプロジェクト名（タグ名）を入力すると、自動的にタグページが作成されます。'
    },
    {
      title: 'ガントチャート表示',
      content: 'タスクの期限や進捗状況は、ガントチャートで視覚的に確認できます。プロジェクト全体の進行状況を把握するのに便利です。'
    },
    {
      title: '準備完了！',
      content: 'これで基本的な使い方の説明は終わりです。さっそく使ってみましょう！'
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    console.log('TutorialComponent constructor called');
  }

  ngOnInit() {
    console.log('TutorialComponent ngOnInit called');
    
    // ユーザーがログインしているか確認
    this.authService.getCurrentUser().subscribe(user => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');
      
      if (user) {
        this.userId = user.uid;
        // ユーザーIDと紐づけてチュートリアルの表示状態を管理
        const hideTutorialKey = `hideTutorial_${this.userId}`;
        const hideTutorial = localStorage.getItem(hideTutorialKey);
        const tutorialCompleted = sessionStorage.getItem('tutorialCompleted');
        console.log('Tutorial status:', { hideTutorial, tutorialCompleted });
        
        if (!hideTutorial && !tutorialCompleted) {
          console.log('Tutorial not completed and not hidden, showing tutorial');
          this.currentStep = 1;
        } else {
          console.log('Tutorial already completed or hidden, hiding tutorial');
          this.currentStep = 0;
        }
      } else {
        console.log('No user logged in, hiding tutorial');
        this.currentStep = 0;
        this.userId = null;
        // ログアウト時にセッションストレージをクリア
        sessionStorage.removeItem('tutorialCompleted');
      }
    });
  }

  getCurrentStepTitle(): string {
    return this.steps[this.currentStep - 1].title;
  }

  getCurrentStepContent(): string {
    return this.steps[this.currentStep - 1].content;
  }

  nextStep() {
    if (this.currentStep < this.steps.length) {
      this.currentStep++;
    } else {
      this.completeTutorial();
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  skipTutorial() {
    this.completeTutorial();
  }

  private completeTutorial() {
    sessionStorage.setItem('tutorialCompleted', 'true');
    if (this.hideNextTime && this.userId) {
      const hideTutorialKey = `hideTutorial_${this.userId}`;
      localStorage.setItem(hideTutorialKey, 'true');
    }
    this.currentStep = 0;
  }

  onHideOptionChange() {
    console.log('次回から表示しない設定:', this.hideNextTime);
  }
} 