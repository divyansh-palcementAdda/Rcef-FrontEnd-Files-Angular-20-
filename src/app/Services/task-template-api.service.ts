import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environment/environment';

export interface TaskTemplateCategoryDto {
  id?: number;
  name: string;
  subcategory?: string;
  isActive?: boolean;
}

export interface TaskTemplateFieldDto {
  id?: number;
  fieldName: string;
  fieldType: string; // TEXT, NUMBER, PERCENTAGE, DATE, DROPDOWN, MULTISELECT, LIST, FILE_UPLOAD, EXCEL_UPLOAD, CSV_UPLOAD, BOOLEAN
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

export interface ProofTypeDto {
  id?: number;
  proofTypeName: string;
  fieldType?: string;
  options?: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  status?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TaskTemplateApiService {
  private readonly baseUrl = `${environment.apiUrl}/task-templates`;

  constructor(private http: HttpClient) {}

  getAllTemplates(): Observable<ApiResponse<TaskTemplateDto[]>> {
    return this.http.get<ApiResponse<TaskTemplateDto[]>>(this.baseUrl);
  }

  getAllCategories(): Observable<ApiResponse<TaskTemplateCategoryDto[]>> {
    return this.http.get<ApiResponse<TaskTemplateCategoryDto[]>>(`${this.baseUrl}/categories`);
  }

  createTemplate(dto: TaskTemplateDto): Observable<ApiResponse<TaskTemplateDto>> {
    return this.http.post<ApiResponse<TaskTemplateDto>>(this.baseUrl, dto);
  }

  updateTemplate(id: number, dto: TaskTemplateDto): Observable<ApiResponse<TaskTemplateDto>> {
    return this.http.put<ApiResponse<TaskTemplateDto>>(`${this.baseUrl}/${id}`, dto);
  }

  deleteTemplate(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }

  createCategory(dto: TaskTemplateCategoryDto): Observable<ApiResponse<TaskTemplateCategoryDto>> {
    return this.http.post<ApiResponse<TaskTemplateCategoryDto>>(`${this.baseUrl}/categories`, dto);
  }

  updateCategory(id: number, dto: TaskTemplateCategoryDto): Observable<ApiResponse<TaskTemplateCategoryDto>> {
    return this.http.put<ApiResponse<TaskTemplateCategoryDto>>(`${this.baseUrl}/categories/${id}`, dto);
  }

  // Dynamic Proof Types API
  private readonly proofTypesUrl = `${environment.apiUrl}/proof-types`;

  getAllProofTypes(): Observable<ApiResponse<ProofTypeDto[]>> {
    return this.http.get<ApiResponse<ProofTypeDto[]>>(this.proofTypesUrl);
  }

  createProofType(dto: ProofTypeDto): Observable<ApiResponse<ProofTypeDto>> {
    return this.http.post<ApiResponse<ProofTypeDto>>(this.proofTypesUrl, dto);
  }

  updateProofType(id: number, dto: ProofTypeDto): Observable<ApiResponse<ProofTypeDto>> {
    return this.http.put<ApiResponse<ProofTypeDto>>(`${this.proofTypesUrl}/${id}`, dto);
  }

  deleteProofType(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.proofTypesUrl}/${id}`);
  }
}
