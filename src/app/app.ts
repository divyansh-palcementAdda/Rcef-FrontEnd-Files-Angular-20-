import { Component, signal, inject, HostListener } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Navbar } from './components/Shared/navbar/navbar';
import { SidebarComponent } from './components/Shared/sidebar/sidebar';
import { TopbarComponent } from './components/Shared/topbar/topbar';
import { BottomNavComponent } from './components/Shared/bottom-nav/bottom-nav';
import { AuthApiService } from './Services/auth-api-service';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

// Standalone Modal Components
import { AddUserComponent } from './components/Auth/add-user/add-user';
import { AddDepartmentComponent } from './components/Department/add-department/add-department';
import { AddTaskComponent } from './components/Tasks/add-task/add-task';
import { EditUser } from './components/Users/edit-user/edit-user';
import { UpdateTaskComponent } from './components/Tasks/update-task/update-task';
import { ModalService } from './Services/modal-service';
import { SidebarService } from './Services/sidebar-service';
import { ConfirmDialogComponent } from './components/Shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    Navbar, 
    SidebarComponent, 
    TopbarComponent,
    BottomNavComponent,
    AddUserComponent,
    AddDepartmentComponent,
    AddTaskComponent,
    EditUser,
    UpdateTaskComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('AreYouReporting');
  isLoggedIn$: Observable<boolean>;
  isHomeActive = false;

  activeModal: string | null = null;
  editUserId: number | null = null;
  editDepartmentId: number | null = null;

  private modalService = inject(ModalService);
  private route = inject(ActivatedRoute);
  public sidebarService = inject(SidebarService);

  constructor(private authService: AuthApiService, private router: Router) {
    this.isLoggedIn$ = this.authService.isLoggedIn$;
    
    // Track if current route is the landing page
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects || event.url || '';
      const path = url.split('?')[0];
      this.isHomeActive = path === '/' || path === '/home' || path === '' || path === '/login';
    });

    // Listen to query parameters to open modals
    this.route.queryParams.subscribe(params => {
      this.activeModal = params['modal'] || null;
      this.editUserId = params['id'] && this.activeModal === 'edit-user' ? +params['id'] : null;
      this.editDepartmentId = params['id'] && this.activeModal === 'add-department' ? +params['id'] : null;

      if (this.activeModal) {
        document.body.classList.add('modal-open');
      } else {
        document.body.classList.remove('modal-open');
      }
    });
  }

  closeActiveModal(success: boolean = false): void {
    const modalName = this.activeModal;
    if (!modalName) return;

    // Clear query parameters
    const currentParams = { ...this.route.snapshot.queryParams };
    delete currentParams['modal'];
    delete currentParams['id'];
    delete currentParams['departmentId'];
    delete currentParams['taskId'];
    delete currentParams['userId'];

    this.router.navigate([], {
      queryParams: currentParams,
      replaceUrl: true
    }).then(() => {
      // Notify lists that the modal closed and whether it was successful
      this.modalService.emitClose(modalName, success);
    });
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: any) {
    if (this.activeModal) {
      this.closeActiveModal(false);
    }
    this.sidebarService.setMobileSidebarOpen(false);
  }

  closeMobileSidebar(): void {
    this.sidebarService.setMobileSidebarOpen(false);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.activeModal) return;
    
    if (event.key === 'Tab') {
      const modalEl = document.querySelector('.modal-window-wrapper');
      if (!modalEl) return;
      
      const focusableElements = modalEl.querySelectorAll(
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
      );
      
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      
      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          lastElement.focus();
          event.preventDefault();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          firstElement.focus();
          event.preventDefault();
        }
      }
    }
  }
}

