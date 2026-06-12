import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modalClosedSource = new Subject<{ modal: string; success: boolean }>();
  modalClosed$ = this.modalClosedSource.asObservable();

  emitClose(modal: string, success: boolean) {
    this.modalClosedSource.next({ modal, success });
  }
}
