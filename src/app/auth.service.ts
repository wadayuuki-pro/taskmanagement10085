import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from '@angular/fire/auth';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { NgZone } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private auth: Auth,
    private ngZone: NgZone
  ) {}

  async signUp(email: string, password: string): Promise<User> {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    return userCredential.user;
  }

  async signIn(email: string, password: string): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
    return userCredential.user;
  }

  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    try {
      // まずポップアップでのログインを試みる
      const result = await signInWithPopup(this.auth, provider);
      return result.user;
    } catch (error: any) {
      // ポップアップがブロックされた場合やキャンセルされた場合はリダイレクト方式を試す
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        console.log('ポップアップがブロックされました。リダイレクト方式を試みます...');
        await signInWithRedirect(this.auth, provider);
        // リダイレクト後の結果を待つ
        const redirectResult = await getRedirectResult(this.auth);
        if (redirectResult) {
          return redirectResult.user;
        }
      }
      throw error;
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  getCurrentUser(): Observable<User | null> {
    return new Observable((observer) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        this.ngZone.run(() => {
          observer.next(user);
        });
      });
      
      return () => unsubscribe();
    });
  }
}