import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-page-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './page-toolbar.component.html',
  styleUrls: ['./page-toolbar.component.css']
})
export class PageToolbarComponent {
  // Configurable Inputs
  @Input() showSearch = true;
  @Input() searchPlaceholder = 'Search...';
  @Input() searchValue = '';

  @Input() showFilters = true;
  @Input() activeChips: Array<{ key: string, label: string }> = [];

  @Input() showRefresh = true;
  @Input() refreshLoading = false;

  @Input() showExport = false;
  @Input() exportLabel = 'Export';

  @Input() showUpload = false;
  @Input() uploadLabel = 'Upload';

  @Input() showAdd = false;
  @Input() addLabel = '+ Add';

  // Event Outputs
  @Output() searchChange = new EventEmitter<string>();
  @Output() searchClear = new EventEmitter<void>();
  @Output() filterClick = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() removeChip = new EventEmitter<string>();
  @Output() refreshClick = new EventEmitter<void>();
  @Output() exportClick = new EventEmitter<void>();
  @Output() uploadClick = new EventEmitter<void>();
  @Output() addClick = new EventEmitter<void>();

  // Sticky scroll detection
  isScrolled = false;

  // Collapse chips state
  isChipsExpanded = false;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 40;
  }

  // Getter for chips to display based on collapse state
  get visibleChips(): Array<{ key: string, label: string }> {
    if (this.isChipsExpanded || this.activeChips.length <= 3) {
      return this.activeChips;
    }
    return this.activeChips.slice(0, 3);
  }

  // Trigger search change
  onSearchInput(value: string): void {
    this.searchChange.emit(value);
  }

  // Clear search input
  clearSearch(): void {
    this.searchClear.emit();
  }

  // Open filter drawer
  onFilterClick(): void {
    this.filterClick.emit();
  }

  // Clear all filters
  onClearFilters(): void {
    this.clearFilters.emit();
  }

  // Remove individual chip
  onRemoveChip(key: string): void {
    this.removeChip.emit(key);
  }

  // Reload data
  onRefreshClick(): void {
    this.refreshClick.emit();
  }

  // Export action
  onExportClick(): void {
    this.exportClick.emit();
  }

  // Upload action
  onUploadClick(): void {
    this.uploadClick.emit();
  }

  // Add action
  onAddClick(): void {
    this.addClick.emit();
  }

  // Toggle chips collapse/expand
  toggleChipsExpansion(): void {
    this.isChipsExpanded = !this.isChipsExpanded;
  }
}
