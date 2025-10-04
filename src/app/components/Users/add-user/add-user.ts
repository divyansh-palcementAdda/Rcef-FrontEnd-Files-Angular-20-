// import { CommonModule } from '@angular/common';
// import { Component } from '@angular/core';
// import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
// import { Router } from '@angular/router';
// import { ApiService } from '../../../Services/api-service';

// @Component({
//   selector: 'app-add-user',
//   imports: [CommonModule, ReactiveFormsModule],
//   templateUrl: './add-user.html',
//   styleUrl: './add-user.css'
// })
// export class AddUser {

// addUserForm: FormGroup;
//   isSubmitting = false;
//   successMessage: string | null = null;
//   errorMessage: string | null = null;

//   roles = ['ADMIN', 'HOD', 'TEACHER'];
//   statuses = ['ACTIVE', 'INACTIVE'];

//   constructor(
//     private fb: FormBuilder,
//     private apiService: ApiService,
//     private router: Router
//   ) {
//     this.addUserForm = this.fb.group({
//       fullName: ['', [Validators.required, Validators.minLength(3)]],
//       email: ['', [Validators.required, Validators.email]],
//       username: ['', [Validators.required]],
//       password: ['', [Validators.required, Validators.minLength(6)]],
//       role: ['', Validators.required],
//       status: ['ACTIVE', Validators.required],
//       departmentId: [''] // optional for admin; required for others
//     });
//   }

//   onSubmit(): void {
//     if (this.addUserForm.invalid) {
//       this.addUserForm.markAllAsTouched();
//       return;
//     }

//     this.isSubmitting = true;
//     this.successMessage = null;
//     this.errorMessage = null;

//     const payload = this.addUserForm.value;
//     console.log('User Payload:', payload);

//     this.apiService.createUser(payload).subscribe({
//       next: () => {
//         this.isSubmitting = false;
//         this.successMessage = '✅ User added successfully!';
//         this.addUserForm.reset({ status: 'ACTIVE' });
//       },
//       error: (err) => {
//         this.isSubmitting = false;
//         this.errorMessage = err?.error?.message || 'Failed to add user. Please try again.';
//       }
//     });
//   }

//   cancel(): void {
//     this.router.navigate(['/admin/users']);
//   }
// }
