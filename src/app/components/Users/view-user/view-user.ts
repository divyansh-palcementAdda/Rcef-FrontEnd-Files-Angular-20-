import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskApiService } from '../../../Services/task-api-Service';
import { userDto } from '../../../Model/userDto';
import { TaskDto } from '../../../Model/TaskDto';
import { FormsModule } from '@angular/forms';
import { UserApiService } from '../../../Services/UserApiService';
import { UserStatusService } from '../../../Services/user-status-service';


@Component({
  selector: 'app-view-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-user.html',
  styleUrls: ['./view-user.css']
})
export class ViewUserComponent implements OnInit {
  userId!: number;
  user: userDto | null = null;
  userTasks: TaskDto[] = [];

  loadingUser = true;
  loadingTasks = false;
  errorMessage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private userService: UserApiService,
    private taskService: TaskApiService,
    private router: Router,
    private userStatusService: UserStatusService

  ) { }
  toggleUserStatus(): void {
  if (this.user) {
    this.userStatusService.toggleUserStatus(this.user).then(() => {
      // Optionally reload user details after update
      this.loadUserDetails();
    });
  }
}
  ngOnInit(): void {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.userId) {
      this.errorMessage = 'Invalid user ID';
      return;
    }
    this.loadUserDetails();
  }

  loadUserDetails(): void {
    this.loadingUser = true;
    this.userService.getUserById(this.userId).subscribe({
      next: (res) => {
        this.user = res;
        this.loadingUser = false;
        this.loadUserTasks();
      },
      error: (err) => {
        this.loadingUser = false;
        this.errorMessage = err?.error?.message || 'Failed to load user details.';
      }
    });
  }

  loadUserTasks(): void {
    this.loadingTasks = true;
    this.taskService.getTasksByUser(this.userId).subscribe({
      next: (res) => {
        // res is of type { success, message, data }
        this.handleTaskResponse(res.data || []); // pass TaskDto[] to handler
      },

      error: (err) => {
        this.loadingTasks = false;
        console.error('Error fetching user tasks', err);
      }
    });
  }
  private handleTaskResponse(tasks: TaskDto[] | null): void {
    this.userTasks = tasks || [];
  }

  editUser(): void {
    this.router.navigate(['/user/edit', this.userId]);
  }

  deleteUser(): void {
    if (confirm('Are you sure you want to delete this user?')) {
      this.userService.deleteUser(this.userId).subscribe({
        next: () => {
          alert('User deleted successfully.');
          this.router.navigate(['/users']);
        },
        error: (err) => {
          alert(err?.error?.message || 'Failed to delete user.');
        }
      });
    }
  }
}
