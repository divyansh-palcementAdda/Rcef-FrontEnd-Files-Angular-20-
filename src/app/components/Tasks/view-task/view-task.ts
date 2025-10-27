// import { Component, OnInit } from '@angular/core';
// import { ActivatedRoute, Router } from '@angular/router';
// import { CommonModule } from '@angular/common';
// import { TaskDto } from '../../../Model/TaskDto';
// import { TaskApiService } from '../../../Services/task-api-Service';

// @Component({
//   selector: 'app-view-task',
//   standalone: true,
//   templateUrl: './view-task.html',
//   styleUrls: ['./view-task.css'],
//   imports: [CommonModule]
// })
// export class ViewTask implements OnInit {
//   task?: TaskDto;
//   isLoading = false;
//   errorMessage = '';

//   constructor(
//     private route: ActivatedRoute,
//     private taskService: TaskApiService,
//     private router: Router
//   ) {}

//   ngOnInit(): void {
//     const taskId = Number(this.route.snapshot.paramMap.get('taskId'));
//     if (taskId) {
//       this.loadTask(taskId);
//     } else {
//       this.errorMessage = 'Invalid Task ID';
//     }
//   }

//   loadTask(taskId: number): void {
//     this.isLoading = true;
//     this.taskService.getTaskById(taskId).subscribe({
//       next: (res) => {
//         this.task = res.data; // ✅ unwrap ApiResponse<TaskDto>
//         this.isLoading = false;
//       },
//       error: (err) => {
//         this.isLoading = false;
//         this.errorMessage = 'Failed to fetch task details';
//         console.error('Error fetching task:', err);
//       }
//     });
//   }

//   editTask(): void {
//     if (this.task?.taskId) {
//       this.router.navigate(['/edit-task', this.task.taskId]);
//     }
//   }

//   goBack(): void {
//     this.router.navigate(['/tasks']);
//   }
// }
