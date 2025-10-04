import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../Services/api-service';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-user.html',
  styleUrls: ['./add-user.css']
})
export class AddUserComponent implements OnInit {
  userForm: FormGroup;
  isSubmitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  roles =  ['HOD', 'TEACHER'];
  departments: any[] = [];

  showPassword = false;
  passwordStrength = { score: 0, label: '', color: '' };

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router
  ) {
    this.userForm = this.fb.group({
      username: [
        '',
        [Validators.required, Validators.minLength(3), Validators.maxLength(80),
        Validators.pattern(/^[a-zA-Z0-9._-]+$/)]
      ],
      password: [
        '',
        [Validators.required, Validators.minLength(8), Validators.maxLength(64),
        Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!])(?=\S+$).{8,64}$/)]
      ],
      email: [
        '',
        [Validators.required, Validators.email, Validators.maxLength(200),
        Validators.pattern(/^[A-Za-z0-9+_.-]+@[A-Za-z.]+$/)]
      ],
      fullName: [
        '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(80),
        Validators.pattern(/^[A-Za-z]+([ '-][A-Za-z]+)*$/)]
      ],
      role: ['', Validators.required],
      departmentId: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadDepartments();

    this.userForm.get('password')?.valueChanges.subscribe(value => {
      this.passwordStrength = this.evaluatePasswordStrength(value || '');
    });
  }

  loadDepartments(): void {
    this.apiService.getAllDepartments().subscribe({
      next: (data) => this.departments = data,
      error: (err) => console.error('Failed to load departments', err)
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  evaluatePasswordStrength(password: string): { score: number; label: string; color: string } {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[@#$%^&+=!]/.test(password)) score += 1;

    if (score <= 2) return { score: 20, label: 'Weak', color: '#e74a3b' };
    if (score === 3 || score === 4) return { score: 60, label: 'Medium', color: '#f6c23e' };
    return { score: 100, label: 'Strong', color: '#1cc88a' };
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const payload = this.userForm.value;

    this.apiService.createUser(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = '✅ User created successfully!';
        this.userForm.reset();
        this.passwordStrength = { score: 0, label: '', color: '' };
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Failed to create user.';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/users']);
  }
}
