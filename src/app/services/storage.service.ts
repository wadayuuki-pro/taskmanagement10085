import { Injectable } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  constructor(private storage: Storage) {}

  async uploadImage(file: File, taskId: string): Promise<string> {
    try {
      const timestamp = new Date().getTime();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${taskId}_${timestamp}.${fileExtension}`;
      const storageRef = ref(this.storage, `task-images/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('画像がアップロードされました:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('画像のアップロードに失敗しました:', error);
      throw error;
    }
  }
} 