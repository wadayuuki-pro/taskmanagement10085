import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';
import { Comment } from '../models/comment.model';
import { Observable, from, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  constructor(private firestore: Firestore) {}

  // コメントを追加
  async addComment(comment: Omit<Comment, 'id'>): Promise<string> {
    const commentsRef = collection(this.firestore, 'comments');
    const docRef = await addDoc(commentsRef, {
      ...comment,
      createdAt: new Date(),
    });
    return docRef.id;
  }

  // タグに関連するコメントを取得
  getCommentsByTagId(tagId: string): Observable<Comment[]> {
    const commentsRef = collection(this.firestore, 'comments');
    const q = query(
      commentsRef,
      where('tagId', '==', tagId),
      orderBy('createdAt', 'desc')
    );

    return from(getDocs(q)).pipe(
      map(snapshot => 
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Comment))
      )
    );
  }

  // コメントを削除
  async deleteComment(commentId: string): Promise<void> {
    const commentRef = doc(this.firestore, 'comments', commentId);
    await deleteDoc(commentRef);
  }

  // コメントを更新
  async updateComment(commentId: string, content: string): Promise<void> {
    const commentRef = doc(this.firestore, 'comments', commentId);
    await updateDoc(commentRef, {
      content,
      updatedAt: new Date()
    });
  }
} 