import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

@Component({
  selector: 'app-footer',
  imports: [CommonModule,FormsModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class Footer {
  email = signal('');

  footerSections = signal<FooterSection[]>([
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Dashboard', href: '#' },
        { label: 'Integrations', href: '#' },
        { label: 'Documentation', href: '#' }
      ]
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '#' },
        { label: 'Careers', href: '#' },
        { label: 'Blog', href: '#' },
        { label: 'Press Kit', href: '#' }
      ]
    },
    {
      title: 'Resources',
      links: [
        { label: 'Help Center', href: '#' },
        { label: 'Community', href: '#' },
        { label: 'Tutorials', href: '#' },
        { label: 'Contact', href: '#' }
      ]
    }
  ]);

  socialLinks = signal([
    { name: 'github', icon: 'github' },
    { name: 'twitter', icon: 'twitter' },
    { name: 'linkedin', icon: 'linkedin' },
    { name: 'mail', icon: 'mail' }
  ]);

  onSubscribe() {
    console.log('Subscribe clicked with email:', this.email());
    // todo: Implement newsletter subscription
    this.email.set('');
  }

  updateEmail(event: Event) {
    const input = event.target as HTMLInputElement;
    this.email.set(input.value);
  }
}