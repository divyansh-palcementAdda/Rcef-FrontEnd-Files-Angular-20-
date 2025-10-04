import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  imports: [CommonModule,FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css'
})
export class Contact {
  contact = {
    name: '',
    email: '',
    message: ''
  };

  submitForm() {
    alert(`Thanks ${this.contact.name}, your message has been sent!`);
    this.contact = { name: '', email: '', message: '' };
  }
}

