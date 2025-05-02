import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, collection, query, where, getDocs } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth.service';
import { User } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class TagService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  // プロジェクトにアサインされているユーザーを取得
  async getAssignedUsers(tagId: string): Promise<{ email: string; displayName: string }[]> {
    try {
      // まずタグ名で検索を試みる
      const tagCollectionRef = collection(this.firestore, 'tags');
      const tagQuery = query(tagCollectionRef, where('name', '==', tagId));
      const tagSnapshot = await getDocs(tagQuery);
      
      let tagDoc;
      if (!tagSnapshot.empty) {
        // タグ名で見つかった場合
        tagDoc = tagSnapshot.docs[0];
        console.log(`タグ名でタグを見つけました: ${tagId}`);
      } else {
        // タグ名で見つからない場合、IDで検索を試みる
        const tagRef = doc(this.firestore, 'tags', tagId);
        tagDoc = await getDoc(tagRef);
        if (!tagDoc.exists()) {
          console.log(`タグが見つかりません: ${tagId}`);
          return [];
        }
      }

      const tagData = tagDoc.data();
      if (!tagData) {
        console.error(`タグデータが空です: ${tagId}`);
        return [];
      }

      // assignedUsersまたはassignedUserIdsからユーザー情報を取得
      const assignedUsers = tagData['assignedUsers'] || [];
      const assignedUserIds = tagData['assignedUserIds'] || [];

      if (assignedUsers.length > 0) {
        // assignedUsersが存在する場合はそのまま返す
        return assignedUsers;
      } else if (assignedUserIds.length > 0) {
        // assignedUserIdsが存在する場合はユーザー情報を取得
        const users = await Promise.all(assignedUserIds.map(async (userId: string) => {
          try {
            const userDoc = await getDoc(doc(this.firestore, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                email: userData['email'] || userId,
                displayName: userData['displayName'] || 'ユーザー'
              };
            }
            console.warn(`ユーザーが見つかりません: ${userId}`);
            return { email: userId, displayName: 'ユーザー' };
          } catch (error) {
            console.error(`ユーザー情報の取得に失敗しました: ${userId}`, error);
            return { email: userId, displayName: 'ユーザー' };
          }
        }));
        return users.filter(user => user !== null);
      } else {
        console.log(`タグ ${tagId} にはアサインされたユーザーがありません。`);
        return [];
      }
    } catch (error) {
      console.error(`プロジェクトユーザーの取得に失敗しました: ${tagId}`, error);
      return [];
    }
  }
} 