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
   * 🔹 Toggles user active/inactive status with confirmation
   */
  async toggleUserStatus(user: userDto): Promise<void> {
    if (!user || !user.userId) return;

    const action = user.status === 'ACTIVE' ? 'Deactivate' : 'Activate';
    const confirmMsg = `Are you sure you want to ${action.toLowerCase()} this user (${user.fullName})?`;

    if (!confirm(confirmMsg)) return;

    try {
      const response = await firstValueFrom(
        this.userService.toggleUserStatus(user.userId)
      );

      alert(response?.message || `User ${action.toLowerCase()}d successfully.`);
      // You can refresh component data after this call
    } catch (err: any) {
      alert(err?.error?.message || `Failed to ${action.toLowerCase()} user.`);
    }
  }

  /**
   * 🔹 Handle case where admin tries to add an existing but inactive user
   */
  async handleInactiveUser(existingUser: userDto): Promise<boolean> {
    const confirmMsg = `⚠️ This user (${existingUser.fullName}) already exists but is inactive.
Would you like to reactivate this user?`;

    const confirmAction = confirm(confirmMsg);

    if (confirmAction) {
      try {
        const response = await firstValueFrom(
          this.userService.toggleUserStatus(existingUser.userId)
        );
        alert(response?.message || 'User reactivated successfully.');
        return true;
      } catch (err: any) {
        alert(err?.error?.message || 'Failed to reactivate user.');
        return false;
      }
    }
    return false; // Cancelled
  }
}
