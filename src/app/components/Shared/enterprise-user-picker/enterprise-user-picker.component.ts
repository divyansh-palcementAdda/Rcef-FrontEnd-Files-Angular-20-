import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';
import { UserApiService } from '../../../Services/UserApiService';
import { userDto } from '../../../Model/userDto';

@Component({
  selector: 'app-enterprise-user-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './enterprise-user-picker.component.html',
  styleUrls: ['./enterprise-user-picker.component.css']
})
export class EnterpriseUserPickerComponent implements OnInit, OnDestroy {
  @Input() roleFilter: string = 'HOD';
  @Input() statusFilter: string = 'ACTIVE';
  @Input() excludedUserIds: number[] = [];
  @Input() isMultiSelect: boolean = true;
  @Input() placeholder: string = 'Search HOD candidate by name, username, email...';

  @Output() selectionChange = new EventEmitter<userDto[]>();

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  users: userDto[] = [];
  selectedUsers: userDto[] = [];
  searchTerm: string = '';

  loading: boolean = false;
  loadingMore: boolean = false;
  dropdownOpen: boolean = false;
  activeIndex: number = -1;

  currentPage: number = 0;
  pageSize: number = 15;
  totalPages: number = 1;
  totalElements: number = 0;

  private searchSubject$ = new Subject<string>();
  private searchSubscription!: Subscription;

  constructor(
    private userApiService: UserApiService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => {
        this.currentPage = 0;
        this.users = [];
        this.activeIndex = -1;
        this.loading = true;
      }),
      switchMap(query => this.executeSearchCall(query))
    ).subscribe({
      next: (res: any) => {
        this.handleSearchResponse(res, false);
      },
      error: (err: any) => {
        console.error('Error fetching users in picker', err);
        this.loading = false;
      }
    });

    // Initial fetch
    this.fetchUsers(0, false);
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onSearchInput(): void {
    this.dropdownOpen = true;
    this.activeIndex = -1;
    this.searchSubject$.next(this.searchTerm.trim());
  }

  onFocus(): void {
    this.dropdownOpen = true;
    if (this.users.length === 0 && !this.loading) {
      this.fetchUsers(0, false);
    }
  }

  private executeSearchCall(query: string) {
    const params: any = {
      page: this.currentPage,
      size: this.pageSize,
      sortBy: 'fullName',
      sortDirection: 'asc'
    };

    if (query) {
      params.search = query;
    }
    if (this.roleFilter) {
      params.role = this.roleFilter;
    }
    if (this.statusFilter) {
      params.status = this.statusFilter;
    }

    return this.userApiService.searchUsers(params).pipe(
      catchError(err => {
        console.error('API Error in EnterpriseUserPicker', err);
        return of(null);
      })
    );
  }

  fetchUsers(page: number, isScroll: boolean): void {
    if (isScroll) {
      this.loadingMore = true;
    } else {
      this.loading = true;
    }

    const params: any = {
      page: page,
      size: this.pageSize,
      sortBy: 'fullName',
      sortDirection: 'asc'
    };

    if (this.searchTerm.trim()) {
      params.search = this.searchTerm.trim();
    }
    if (this.roleFilter) {
      params.role = this.roleFilter;
    }
    if (this.statusFilter) {
      params.status = this.statusFilter;
    }

    this.userApiService.searchUsers(params).subscribe({
      next: (res: any) => {
        this.handleSearchResponse(res, isScroll);
      },
      error: (err: any) => {
        console.error('Error fetching users in picker', err);
        this.loading = false;
        this.loadingMore = false;
      }
    });
  }

  private handleSearchResponse(res: any, isScroll: boolean): void {
    this.loading = false;
    this.loadingMore = false;

    if (res && res.success && res.data) {
      const data = res.data;
      const newItems: userDto[] = data.content || [];
      this.totalPages = data.pagination?.totalPages ?? 1;
      this.totalElements = data.pagination?.totalElements ?? 0;
      this.currentPage = data.pagination?.currentPage ?? 0;

      if (isScroll) {
        const existingIds = new Set(this.users.map(u => u.userId));
        const filteredNew = newItems.filter(u => !existingIds.has(u.userId));
        this.users = [...this.users, ...filteredNew];
      } else {
        this.users = newItems;
      }
    }
  }

  onDropdownScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target) return;

    const threshold = 30;
    const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - threshold;

    if (atBottom && !this.loading && !this.loadingMore && (this.currentPage + 1) < this.totalPages) {
      this.fetchUsers(this.currentPage + 1, true);
    }
  }

  isExcluded(userId: number): boolean {
    return (this.excludedUserIds || []).includes(userId);
  }

  isSelected(userId: number): boolean {
    return this.selectedUsers.some(u => u.userId === userId);
  }

  toggleUser(user: userDto, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isExcluded(user.userId)) return;

    if (this.isSelected(user.userId)) {
      this.selectedUsers = this.selectedUsers.filter(u => u.userId !== user.userId);
    } else {
      if (this.isMultiSelect) {
        this.selectedUsers = [...this.selectedUsers, user];
      } else {
        this.selectedUsers = [user];
        this.dropdownOpen = false;
      }
    }

    this.selectionChange.emit(this.selectedUsers);
  }

  removeSelectedUser(userId: number, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedUsers = this.selectedUsers.filter(u => u.userId !== userId);
    this.selectionChange.emit(this.selectedUsers);
  }

  clearAll(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedUsers = [];
    this.selectionChange.emit(this.selectedUsers);
  }

  getUserInitials(name?: string): string {
    if (!name) return '?';
    return name.trim().split(' ').slice(0, 2).map(p => p.charAt(0)).join('').toUpperCase();
  }

  @HostListener('keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (!this.dropdownOpen) {
      if (event.key === 'ArrowDown') {
        this.dropdownOpen = true;
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, this.users.length - 1);
      this.scrollToActive();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
      this.scrollToActive();
    } else if (event.key === 'Enter') {
      if (this.activeIndex >= 0 && this.activeIndex < this.users.length) {
        event.preventDefault();
        this.toggleUser(this.users[this.activeIndex]);
      }
    } else if (event.key === 'Escape') {
      this.dropdownOpen = false;
      this.activeIndex = -1;
    }
  }

  private scrollToActive(): void {
    if (!this.scrollContainer || this.activeIndex < 0) return;
    const containerEl = this.scrollContainer.nativeElement as HTMLElement;
    const activeEl = containerEl.children[this.activeIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  @HostListener('click', ['$event'])
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) return;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.dropdownOpen = false;
      this.activeIndex = -1;
    }
  }
}
