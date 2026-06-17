import { Injectable } from '@angular/core';
import { UserApiService } from './UserApiService';
import { userDto } from '../Model/userDto';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserStatusService {
  constructor(private userService: UserApiService) {}

  /**
   * Toggles user active/inactive status (no confirm — caller handles confirmation)
   */
  async toggleUserStatus(user: userDto): Promise<{ success: boolean; message: string }> {
    if (!user || !user.userId) {
      return { success: false, message: 'Invalid user' };
    }

    try {
      const response = await firstValueFrom(
        this.userService.toggleUserStatus(user.userId)
      );
      const action = user.status === 'ACTIVE' ? 'deactivated' : 'activated';
      return { success: true, message: response?.message || `User ${action} successfully.` };
    } catch (err: any) {
      const action = user.status === 'ACTIVE' ? 'deactivate' : 'activate';
      return { success: false, message: err?.error?.message || `Failed to ${action} user.` };
    }
  }

  /**
   * Reactivates an inactive user (no confirm — caller handles confirmation)
   */
  async handleInactiveUser(existingUser: userDto): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.userService.toggleUserStatus(existingUser.userId)
      );
      return true;
    } catch (err: any) {
      return false;
    }
  }
}
