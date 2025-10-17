import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Department } from '../Model/department';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class DepartmentApiService {

   private apiUrl = `${environment.apiUrl}`;


  constructor(private http: HttpClient) { }
   // ---------------- Department APIs ----------------
    getAllDepartments(): Observable<Department[]> {
      console.log('Fetching departments from:', `${this.apiUrl}/departments`);
      return this.http.get<Department[]>(`${this.apiUrl}/departments`);
    }
  
    createDepartment(payload: Department) {
      console.log('Creating department with payload:', payload);
      return this.http.post(`${this.apiUrl}/departments`, payload);
    }

    deleteDepartment(departmentId : number){
      return this.http.delete(`${this.apiUrl}/departments${departmentId}`);
    }
  
}
