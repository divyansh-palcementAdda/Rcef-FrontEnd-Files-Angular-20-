import { Injectable } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  id?: number;
  exp?: number;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class JwtService {

  // ✅ Access Token
  getAccessToken(): string | null {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp * 1000 < Date.now();
      return isExpired ? null : token;
    } catch (error) {
      console.error('Invalid token format:', error);
      return null;
    }
  }

  // ✅ Refresh Token
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  // ✅ Decode JWT safely
  decodeToken(token: string): DecodedToken | null {
    try {
      return jwtDecode<DecodedToken>(token);
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return null;
    }
  }

  // ✅ Extract user ID from token
  getUserIdFromToken(token: string): number | null {
    const decodedToken = this.decodeToken(token);
    return decodedToken?.['userId'] ?? null;
  }

  // ✅ Check if token is valid (not expired)
  isTokenValid(token: string): boolean {
    const decodedToken = this.decodeToken(token);
    if (!decodedToken || !decodedToken.exp) {
      return false;
    }
    const currentTime = Math.floor(Date.now() / 1000);
    return decodedToken.exp > currentTime;
  }
}
