import { HttpInterceptorFn } from '@angular/common/http';
import { HttpRequest, HttpHandlerFn } from '@angular/common/http';

// ✅ Auth Interceptor: Attaches Authorization header to protected requests
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Public endpoints that don’t need JWT
  const publicUrls: string[] = [
    '/api/auth/login' // in case you're using /login
  ];

  // Check if request matches a public endpoint
  const isPublic = publicUrls.some(url => req.url.includes(url));

  if (isPublic) {
    return next(req); // 🚀 no auth needed
  }

  // Get token from localStorage
  const token = localStorage.getItem('token');

  if (token && token.trim() !== '') {
    // Clone request and add Authorization header
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }

  // 🚨 No token found → let request go without Authorization
  return next(req);
};
