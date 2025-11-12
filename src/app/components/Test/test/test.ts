// // refresh-token.component.ts
// import { Component } from '@angular/core';

// import { catchError, of } from 'rxjs';
// import { JWTResponseDTO } from '../../../Model/jwtresponse-dto';
// import { AuthApiService } from '../../../Services/auth-api-service';
// import { CommonModule, JsonPipe } from '@angular/common';

// @Component({
//   selector: 'app-refresh-token',
//   //divyansh/src/app/components/Test/test/test.html
//   templateUrl: './test.html',
//   styleUrls: ['./test.css'],
//   imports:[JsonPipe,CommonModule]
// })
// export class Test {
//   isLoading = false;
//   result: JWTResponseDTO | null = null;
//   errorMsg: string | null = null;

//   // <-- put your actual refresh token here (e.g. from localStorage) -->
//   private readonly currentRefreshToken = localStorage.getItem('refreshToken') ?? '';

//   constructor(private auth: AuthApiService) {}

//   onRefreshClick(): void {
//     if (!this.currentRefreshToken) {
//       this.errorMsg = 'No refresh token available';
//       return;
//     }

//     this.isLoading = true;
//     this.result = null;
//     this.errorMsg = null;

//     this.auth.refreshToken(this.currentRefreshToken)
//       .pipe(
//         catchError(err => {
//           this.errorMsg = err.message;
//           return of(null);   // swallow the error so the stream completes
//         })
//       )
//       .subscribe({
//         next: (data: JWTResponseDTO | null) => {
//           this.isLoading = false;
//           if (data) {
//             this.result = data;

//             // OPTIONAL: store the new tokens
//             localStorage.setItem('accessToken', data.accessToken);
//             if (data.refreshToken) {
//               localStorage.setItem('refreshToken', data.refreshToken);
//             }
//           }
//         },
//         error: () => { this.isLoading = false; }   // already handled in catchError
//       });
//   }
// }