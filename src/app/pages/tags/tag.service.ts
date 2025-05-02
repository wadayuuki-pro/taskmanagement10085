import { Firestore } from '@angular/fire/firestore';
import { collection, collectionData, addDoc, doc, updateDoc, query, orderBy,
     getDocs, collectionSnapshots, writeBatch, where } from '@angular/fire/firestore';
import { deleteDoc } from '@angular/fire/firestore';
import { inject, Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../auth.service';

export interface Tag {
    id?: string;
    name: string;
    order: number;
    createdAt: Date;
    ownerId?: string;
    assignedUserIds?: string[];
}

@Injectable({
    providedIn: 'root'
})
export class TagService {
   private firestore = inject(Firestore);
   private authService = inject(AuthService);

   getTags(): Observable<Tag[]> {
     return this.authService.getCurrentUser().pipe(
       switchMap(user => {
         if (!user) return of([]);
    const tagCollection = collection(this.firestore, 'tags');
         const q = query(
           tagCollection,
           where('ownerId', '==', user.uid)
         );
         const q2 = query(
           tagCollection,
           where('assignedUserIds', 'array-contains', user.uid)
         );
         return combineLatest([
           collectionSnapshots(q),
           collectionSnapshots(q2)
         ]).pipe(
           map(([ownerDocs, assignedDocs]) => {
             const ownerTags = ownerDocs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
             const assignedTags = assignedDocs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
             // 重複を除去して結合
             const allTags = [...ownerTags, ...assignedTags];
             const uniqueTags = allTags.filter((tag, index, self) =>
               index === self.findIndex(t => t.id === tag.id)
             );
             return uniqueTags;
           })
         );
       })
        );
      }

   async addTag(tag: Tag) {
     // 既存のタグをチェック
    const tagCollection = collection(this.firestore, 'tags');
     const q = query(
       tagCollection,
       where('name', '==', tag.name),
       where('ownerId', '==', tag.ownerId)
     );
     const querySnapshot = await getDocs(q);
     
     if (!querySnapshot.empty) {
       // 既存のタグが見つかった場合、エラーをスロー
       throw new Error('同じ名前のタグが既に存在します');
     }
     
     // 新規タグを追加
    return addDoc(tagCollection, tag);
  }
  
  updateTagOrders(tags: Tag[]) {
    const batch = writeBatch(this.firestore);
    tags.forEach((tag, index) => {
      if (tag.id) {
        const tagRef = doc(this.firestore, 'tags', tag.id);
      batch.update(tagRef, { order: index });
      }
    });
    return batch.commit();
  }

  async deleteTag(tagId: string) {
    const tagRef = doc(this.firestore, 'tags', tagId);
    return deleteDoc(tagRef);
  }
}
  
    
    









