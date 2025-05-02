import { Injectable, ComponentRef, Type, ApplicationRef, Injector, EmbeddedViewRef } from '@angular/core';
import { OverlayRef, Overlay, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

@Injectable({
  providedIn: 'root'
})
export class OverlayService {
  private overlayRef: OverlayRef | null = null;

  constructor(
    private overlay: Overlay,
    private appRef: ApplicationRef,
    private injector: Injector
  ) {}

  open<T>(component: Type<T>, data?: any): ComponentRef<T> | null {
    // 既存のオーバーレイを閉じる
    this.close();

    // オーバーレイの設定
    const config = new OverlayConfig({
      hasBackdrop: true,
      backdropClass: 'overlay-backdrop',
      panelClass: 'overlay-panel',
      positionStrategy: this.overlay.position()
        .global()
        .centerHorizontally()
        .centerVertically()
    });

    // オーバーレイを作成
    this.overlayRef = this.overlay.create(config);

    // コンポーネントをオーバーレイに追加
    const componentRef = this.overlayRef.attach(new ComponentPortal(component, null, this.injector));

    // データをコンポーネントに渡す
    if (data) {
      Object.keys(data).forEach(key => {
        (componentRef.instance as any)[key] = data[key];
      });
    }

    // バックドロップをクリックしたときにオーバーレイを閉じる
    this.overlayRef.backdropClick().subscribe(() => {
      this.close();
    });

    return componentRef;
  }

  close(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }
} 