import {
  Directive,
  ElementRef,
  Renderer2,
  OnDestroy,
  AfterViewInit,
} from '@angular/core';

@Directive({
  selector: '[appDragScroll]',
  standalone: true
})
export class DragScrollDirective implements AfterViewInit, OnDestroy {

  private isPointerDown = false;
  private isDragging = false;
  private hasDragged = false;

  private startX = 0;
  private scrollLeft = 0;

  private readonly DRAG_THRESHOLD = 6;

  private removeListeners: (() => void)[] = [];

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private renderer: Renderer2
  ) {}

  ngAfterViewInit(): void {

    const element = this.elementRef.nativeElement;

    this.renderer.setStyle(element, 'cursor', 'grab');

    this.removeListeners.push(
      this.renderer.listen(element, 'mousedown', this.onMouseDown),
      this.renderer.listen(document, 'mousemove', this.onMouseMove),
      this.renderer.listen(document, 'mouseup', this.onMouseUp),
      this.renderer.listen(element, 'mouseleave', this.onMouseUp),
      this.renderer.listen(document, 'click', this.onClick, { capture: true }) // Use document level capture
    );
  }

  private onMouseDown = (event: MouseEvent) => {

    if (event.button !== 0) {
      return;
    }

    if (this.isInteractiveElement(event.target as HTMLElement)) {
      return;
    }

    const element = this.elementRef.nativeElement;

    this.isPointerDown = true;
    this.isDragging = false;
    this.hasDragged = false;

    this.startX = event.pageX;
    this.scrollLeft = element.scrollLeft;
  };

  private onMouseMove = (event: MouseEvent) => {

    if (!this.isPointerDown) {
      return;
    }

    const element = this.elementRef.nativeElement;

    const delta = event.pageX - this.startX;

    if (!this.isDragging) {

      if (Math.abs(delta) < this.DRAG_THRESHOLD) {
        return;
      }

      this.isDragging = true;
      this.hasDragged = true;

      this.renderer.addClass(element, 'drag-scroll-active');
      this.renderer.setStyle(element, 'cursor', 'grabbing');
      this.renderer.setStyle(document.body, 'user-select', 'none');
      this.renderer.setStyle(document.body, 'cursor', 'grabbing');
    }

    event.preventDefault();

    element.scrollLeft = this.scrollLeft - delta;
  };

  private onMouseUp = () => {

    if (!this.isPointerDown) {
      return;
    }

    this.isPointerDown = false;
    this.isDragging = false;

    const element = this.elementRef.nativeElement;

    this.renderer.removeClass(element, 'drag-scroll-active');

    this.renderer.removeStyle(document.body, 'user-select');
    this.renderer.removeStyle(document.body, 'cursor');

    this.renderer.setStyle(element, 'cursor', 'grab');

    // Reset hasDragged flag after a short delay to prevent click event
    if (this.hasDragged) {
      setTimeout(() => {
        this.hasDragged = false;
      }, 100);
    }
  };

  private onClick = (event: MouseEvent) => {
    // Prevent click event if drag occurred
    if (this.hasDragged) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  };

  /**
   * Don't drag when clicking interactive elements
   */
  private isInteractiveElement(target: HTMLElement | null): boolean {

    if (!target) {
      return false;
    }

    return !!target.closest(`
      button,
      a,
      input,
      textarea,
      select,
      option,
      label,
      mat-select,
      mat-option,
      mat-checkbox,
      mat-radio-button,
      mat-slide-toggle,
      [role="button"],
      [contenteditable="true"]
    `);
  }

  ngOnDestroy(): void {

    this.removeListeners.forEach(fn => fn());

    this.renderer.removeStyle(document.body, 'user-select');
    this.renderer.removeStyle(document.body, 'cursor');
  }

}