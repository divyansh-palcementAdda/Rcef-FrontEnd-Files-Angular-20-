import { Injectable } from '@angular/core';
import {jwtDecode} from 'jwt-decode';

interface DecodedToken {
  id?: number;
  exp?: number; // expiration timestamp (seconds)
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class JwtService {

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
    if (decodedToken && decodedToken['userId']) {
      return decodedToken['userId'];
    }
    return null;
  }

  // ✅ Check if token is valid (not expired)
  isTokenValid(token: string): boolean {
    const decodedToken = this.decodeToken(token);
    if (!decodedToken || !decodedToken.exp) {
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000); // current time in seconds
    return decodedToken.exp > currentTime;
  }
}
