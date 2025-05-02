import { Component,ViewEncapsulation } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css'],
  encapsulation: ViewEncapsulation.Emulated
})
export class SignInComponent {
  email = '';
  password = '';
  passwordVisible = false;
  errorMessage = '';

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  constructor(private authService: AuthService, private router: Router) { }

  async onSignIn() {
    try {
      this.email = this.email.trim();
      this.password = this.password.trim();
      await this.authService.signIn(this.email, this.password);
      this.router.navigate(['/home']);
    } catch (error: any) {
      if(error.code === 'auth/invalid-credential') {
        this.errorMessage = 'E:メールアドレスかパスワードが間違っています';
      }else{
        this.errorMessage = 'E:ログインエラー';
      }
    }
  }

  async signInWithGoogle() {
    try {
      await this.authService.signInWithGoogle();
      this.router.navigate(['/home']);
    } catch (error: any) {
      console.error('Googleログインエラー:', error);
      this.errorMessage = 'Googleログインに失敗しました';
    }
  }
}
