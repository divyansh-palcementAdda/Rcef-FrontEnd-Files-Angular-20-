import { Injectable, Type } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ModalConfig {
  title: string;
  subtitle?: string;
  sizeClass?: string; // modal-sm, modal-md, modal-lg, modal-xl
  data?: any; // inputs passed to the component
  rowNavigation?: {
    [key: string]: (id: any, event?: Event) => void;
  };
}

export interface ModalInstance {
  component: Type<any>;
  config: ModalConfig;
}

@Injectable({
  providedIn: 'root'
})
export class ModalWrapperService {
  private activeModalsSubject = new BehaviorSubject<ModalInstance[]>([]);
  activeModals$: Observable<ModalInstance[]> = this.activeModalsSubject.asObservable();

  open(component: Type<any>, config: ModalConfig): void {
    this.activeModalsSubject.next([{ component, config }]);
  }

  push(component: Type<any>, config: ModalConfig): void {
    const current = this.activeModalsSubject.value;
    this.activeModalsSubject.next([...current, { component, config }]);
  }

  pop(): void {
    const current = this.activeModalsSubject.value;
    if (current.length > 1) {
      this.activeModalsSubject.next(current.slice(0, -1));
    } else {
      this.clear();
    }
  }

  clear(): void {
    this.activeModalsSubject.next([]);
  }

  hasHistory(): boolean {
    return this.activeModalsSubject.value.length > 1;
  }

  getCurrentModal(): ModalInstance | null {
    const current = this.activeModalsSubject.value;
    return current.length > 0 ? current[current.length - 1] : null;
  }

  setStack(instances: ModalInstance[]): void {
    this.activeModalsSubject.next(instances);
  }
}
