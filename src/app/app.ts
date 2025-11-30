import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { JsonPipe, NgIf, NgFor } from '@angular/common';
import axios from 'axios';
import { Navbar } from './components/Shared/navbar/navbar';
import { Footer } from './components/Shared/footer/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ RouterOutlet,Navbar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App  {
  protected readonly title = signal('AreYouReporting');
}
