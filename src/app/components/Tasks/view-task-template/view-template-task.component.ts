import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-view-template-task',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './view-task-template.html',
  styleUrls: ['./view-task-template.css']
})
export class ViewTemplateTaskComponent implements OnInit {
  templateId: number | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.templateId = Number(this.route.snapshot.paramMap.get('id'));
  }
}