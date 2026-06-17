import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';

export interface TaskTemplateCategoryDto {
  id?: number;
  name: string;
  subcategory?: string;
  isActive?: boolean;
}

export interface TaskTemplateFieldDto {
  id?: number;
  fieldName: string;
  fieldType: string;
  isRequired: boolean;
  options?: string;
}

export interface TaskTemplateProofRequirementDto {
  id?: number;
  proofType: string;
  proofTypeId?: number;
  proofTypeName?: string;
  isRequired: boolean;
  fieldType?: string;
  options?: string;
}

export interface TaskTemplateDto {
  id?: number;
  category: TaskTemplateCategoryDto;
  title: string;
  description: string;
  isActive?: boolean;
  fields?: TaskTemplateFieldDto[];
  proofRequirements?: TaskTemplateProofRequirementDto[];
}

@Component({
  selector: 'app-view-template-task',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './view-task-template.html',
  styleUrls: ['./view-task-template.css']
})
export class ViewTemplateTaskComponent implements OnInit {
  templateId: number | null = null;
  
  // Static mock data populated for UI display
  template: TaskTemplateDto = {
    id: 101,
    title: 'Admissions Document Submission Template',
    description: 'This template is used for collecting and verifying student admission documents, including marksheet verification, fee receipts, and registration signatures.',
    isActive: true,
    category: {
      id: 1,
      name: 'Admissions',
      subcategory: 'Registration & Verification',
      isActive: true
    },
    fields: [
      {
        id: 1,
        fieldName: 'Student Name',
        fieldType: 'TEXT',
        isRequired: true
      },
      {
        id: 2,
        fieldName: 'Registration Number',
        fieldType: 'NUMBER',
        isRequired: true
      },
      {
        id: 3,
        fieldName: 'Admission Category',
        fieldType: 'DROPDOWN',
        isRequired: true,
        options: 'General,OBC,SC,ST,EWS'
      },
      {
        id: 4,
        fieldName: 'Is Fee Paid',
        fieldType: 'BOOLEAN',
        isRequired: true
      },
      {
        id: 5,
        fieldName: 'Remarks',
        fieldType: 'TEXT',
        isRequired: false
      }
    ],
    proofRequirements: [
      {
        id: 1,
        proofType: '10TH_MARKSHEET',
        proofTypeName: '10th Marksheet Copy',
        isRequired: true,
        fieldType: 'FILE'
      },
      {
        id: 2,
        proofType: 'FEE_RECEIPT',
        proofTypeName: 'Fee Payment Receipt',
        isRequired: true,
        fieldType: 'FILE'
      },
      {
        id: 3,
        proofType: 'STUDENT_SIGNATURE',
        proofTypeName: 'Student Signature',
        isRequired: false,
        fieldType: 'FILE'
      }
    ]
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.templateId = Number(idParam);
      this.template.id = this.templateId; // Sync dynamic ID with template data
    }
  }

  goBack(): void {
    this.router.navigate(['/task-templates']);
  }
}