import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FilterFieldConfig {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date';
  options?: Array<{ value: any, label: string }>;
  placeholder?: string;
  section: 'general' | 'organization' | 'timeline' | 'advanced';
}

@Component({
  selector: 'app-filter-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-drawer.component.html',
  styleUrls: ['./filter-drawer.component.css']
})
export class FilterDrawerComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() fields: FilterFieldConfig[] = [];
  @Input() values: { [key: string]: any } = {};

  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() apply = new EventEmitter<{ [key: string]: any }>();
  @Output() reset = new EventEmitter<void>();

  tempValues: { [key: string]: any } = {};

  sections = [
    { key: 'general', label: 'General Filters' },
    { key: 'organization', label: 'Organization & Structure' },
    { key: 'timeline', label: 'Timeline & Dates' },
    { key: 'advanced', label: 'Advanced Statuses' }
  ];

  ngOnInit(): void {
    this.resetTempValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['values'] || changes['isOpen']) {
      this.resetTempValues();
    }
  }

  resetTempValues(): void {
    this.tempValues = { ...this.values };
    this.fields.forEach(field => {
      if (this.tempValues[field.key] === undefined || this.tempValues[field.key] === null) {
        this.tempValues[field.key] = '';
      }
    });
  }

  getFieldsBySection(sectionKey: string): FilterFieldConfig[] {
    return this.fields.filter(f => f.section === sectionKey);
  }

  close(): void {
    this.isOpen = false;
    this.isOpenChange.emit(this.isOpen);
  }

  applyFilters(): void {
    this.apply.emit(this.tempValues);
    this.close();
  }

  resetFilters(): void {
    Object.keys(this.tempValues).forEach(k => {
      this.tempValues[k] = '';
    });
    this.reset.emit();
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey() {
    if (this.isOpen) {
      this.close();
    }
  }
}
