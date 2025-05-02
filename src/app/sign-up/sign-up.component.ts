import { Component } from '@angular/core';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { RouterModule } from '@angular/router';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [CommonModule, FormsModule,RouterModule],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.css'
})
export class SignUpComponent {
  email = '';
  password = '';
  errorMessage = '';
  passwordVisible = false;

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  constructor(private authService: AuthService) { }

  async onSignUp() {
    try {
      this.email = this.email.trim();
      this.password = this.password.trim();

      if (!this.email || !this.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        this.errorMessage = 'E:メールアドレスが不正です';
      }
      if (!this.password || this.password.length < 6) {
        this.errorMessage = 'E:パスワードが短すぎます';
      }

      const user = await this.authService.signUp(this.email, this.password);
      console.log('ユーザー登録成功', user.uid);
    } catch (error: any) {
      if(error.code === 'auth/email-already-in-use') {
        this.errorMessage = 'E:このメールアドレスは既に使用されています';
      }
      if(error.code === 'auth/invalid-email') {
        this.errorMessage = 'E:メールアドレスが不正です';
      }
      if(error.code === 'auth/weak-password') {
        this.errorMessage = 'E:パスワードが弱すぎます';
      }
    }
  }

}
