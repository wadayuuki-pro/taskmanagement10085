import { Injectable, Injector, Inject } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { TaskInputComponent } from './task-input.component';
import { TASK_DATA } from './task-input.component';

@Injectable({ providedIn: 'root' })

export class OverlayService {
    private overlayRef?: OverlayRef;

    constructor(@Inject(Overlay) private overlay: Overlay, private injector: Injector) {}

    openTaskInput(taskData?: any, isTagPage: boolean = false) {
        if(this.overlayRef) {
            this.close();
        }

        console.log('OverlayService: タスクデータを受け取りました', taskData, 'isTagPage:', isTagPage);

        this.overlayRef = this.overlay.create({
            hasBackdrop: true,
            backdropClass: 'custom-backdrop',
            panelClass: 'custom-panel',
            positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
        });

        const injector = Injector.create({
            providers: [
                {
                    provide: TASK_DATA,
                    useValue: {
                        ...taskData,
                        isTagPage: isTagPage
                    }
                }
            ],
            parent: this.injector
        });

        const portal = new ComponentPortal(TaskInputComponent, undefined, injector);
        this.overlayRef.attach(portal);

        this.overlayRef.backdropClick().subscribe(() => {
            this.close();
        });
    }


    close(){
        if(this.overlayRef){
            this.overlayRef.dispose();
            this.overlayRef = undefined;
        }
    }
}
