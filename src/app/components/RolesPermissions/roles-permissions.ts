import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UserApiService } from '../../Services/UserApiService';
import { userDto } from '../../Model/userDto';

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  level: number;
  isSystemRole?: boolean;
  permissions?: Permission[];
}

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string;
}

interface AdminPermissionOverride {
  id: string;
  permission: {
    code: string;
  };
  isAllowed: boolean;
}

@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './roles-permissions.html',
  styleUrls: ['./roles-permissions.css']
})
export class RolePermissionManagementComponent implements OnInit {
  activeTab: 'roles' | 'overrides' = 'roles';

  // State Variables
  roles: Role[] = [];
  permissions: Permission[] = [];
  groupedPermissions: { [key: string]: Permission[] } = {};
  admins: userDto[] = [];

  selectedRole: Role | null = null;
  selectedRolePermissions: string[] = [];

  selectedAdmin: userDto | null = null;
  adminOverrides: { [key: string]: boolean } = {}; // permissionCode -> isAllowed

  loadingRoles = false;
  loadingPermissions = false;
  loadingAdmins = false;

  successMessage: string | null = null;
  errorMessage: string | null = null;

  showCreateRoleForm = false;
  newRole = {
    name: '',
    displayName: '',
    description: '',
    level: 5
  };

  constructor(
    private userApiService: UserApiService,
    private snackBar: MatSnackBar,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
  }

  // -------------------------------------------------------------
  // Data Loaders
  // -------------------------------------------------------------
  loadRoles(): void {
    this.loadingRoles = true;
    this.userApiService.getAllRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        this.loadingRoles = false;
        if (roles.length > 0 && !this.selectedRole) {
          this.selectRole(roles[0]);
        }
      },
      error: (err) => {
        this.showError('Failed to load roles: ' + err.message);
        this.loadingRoles = false;
      }
    });
  }

  loadPermissions(): void {
    this.loadingPermissions = true;
    this.userApiService.getAllPermissions().subscribe({
      next: (perms) => {
        this.permissions = perms;
        this.groupPermissions(perms);
        this.loadingPermissions = false;
      },
      error: (err) => {
        this.showError('Failed to load permissions: ' + err.message);
        this.loadingPermissions = false;
      }
    });
  }

  loadAdmins(): void {
    this.loadingAdmins = true;
    this.userApiService.getAllUsers().subscribe({
      next: (users) => {
        this.admins = users.filter(u => u.role === 'ADMIN');
        this.loadingAdmins = false;
      },
      error: (err) => {
        this.showError('Failed to load admins: ' + err.message);
        this.loadingAdmins = false;
      }
    });
  }

  groupPermissions(perms: Permission[]): void {
    this.groupedPermissions = {};
    perms.forEach((p) => {
      const module = p.module || 'OTHER';
      if (!this.groupedPermissions[module]) {
        this.groupedPermissions[module] = [];
      }
      this.groupedPermissions[module].push(p);
    });
  }

  // -------------------------------------------------------------
  // Role Mapping Actions
  // -------------------------------------------------------------
  selectRole(role: Role): void {
    this.selectedRole = role;
    this.loadingPermissions = true;
    this.userApiService.getRoleById(role.id).subscribe({
      next: (detailedRole) => {
        this.selectedRole = detailedRole;
        this.selectedRolePermissions = detailedRole.permissions?.map((p: any) => p.code) || [];
        this.loadingPermissions = false;
      },
      error: (err) => {
        this.showError('Failed to load role details: ' + err.message);
        this.loadingPermissions = false;
      }
    });
  }

  isPermissionAssigned(code: string): boolean {
    return this.selectedRolePermissions.includes(code);
  }

  togglePermission(code: string): void {
    if (this.selectedRolePermissions.includes(code)) {
      this.selectedRolePermissions = this.selectedRolePermissions.filter(p => p !== code);
    } else {
      this.selectedRolePermissions.push(code);
    }
  }

  saveRolePermissions(): void {
    if (!this.selectedRole) return;
    this.userApiService.updateRolePermissions(this.selectedRole.id, this.selectedRolePermissions).subscribe({
      next: () => {
        this.showSuccess('Permissions saved successfully');
        if (this.selectedRole) {
          this.selectRole(this.selectedRole);
        }
      },
      error: (err) => this.showError('Failed to save permissions: ' + err.message)
    });
  }

  createCustomRole(): void {
    if (!this.newRole.name || !this.newRole.displayName) {
      this.showError('Role name and display name are required');
      return;
    }
    this.userApiService.createRoleEntity(this.newRole).subscribe({
      next: (created) => {
        this.showSuccess('Role created successfully');
        this.showCreateRoleForm = false;
        this.newRole = { name: '', displayName: '', description: '', level: 5 };
        this.loadRoles();
      },
      error: (err) => this.showError('Failed to create role: ' + err.message)
    });
  }

  // -------------------------------------------------------------
  // Overrides Tab Actions
  // -------------------------------------------------------------
  selectAdmin(admin: userDto): void {
    this.selectedAdmin = admin;
    this.adminOverrides = {};
    this.userApiService.getAdminPermissions(admin.userId).subscribe({
      next: (overrides: AdminPermissionOverride[]) => {
        overrides.forEach((o) => {
          this.adminOverrides[o.permission.code] = o.isAllowed;
        });
      },
      error: (err) => this.showError('Failed to load admin overrides: ' + err.message)
    });
  }

  getOverrideStatus(code: string): 'DEFAULT' | 'ALLOWED' | 'DENIED' {
    if (this.adminOverrides[code] === undefined) {
      return 'DEFAULT';
    }
    return this.adminOverrides[code] ? 'ALLOWED' : 'DENIED';
  }

  onOverrideChange(code: string, val: 'DEFAULT' | 'ALLOWED' | 'DENIED'): void {
    if (!this.selectedAdmin) return;

    if (val === 'DEFAULT') {
      this.userApiService.deleteAdminPermission(this.selectedAdmin.userId, code).subscribe({
        next: () => {
          this.showSuccess('Permission override reverted to default');
          if (this.selectedAdmin) {
            this.selectAdmin(this.selectedAdmin);
          }
        },
        error: (err) => this.showError('Failed to revert override: ' + err.message)
      });
      return;
    }

    const isAllowed = val === 'ALLOWED';

    const payload = {
      adminId: this.selectedAdmin.userId,
      permissionCode: code,
      isAllowed: isAllowed
    };

    this.userApiService.configureAdminPermission(payload).subscribe({
      next: () => {
        this.showSuccess('Permission override updated');
        if (this.selectedAdmin) {
          this.selectAdmin(this.selectedAdmin);
        }
      },
      error: (err) => this.showError('Failed to configure override: ' + err.message)
    });
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  goBack(): void {
    this.location.back();
  }

  showSuccess(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = null;
    this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: ['snackbar-success'] });
  }

  showError(msg: string): void {
    this.errorMessage = msg;
    this.successMessage = null;
    this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: ['snackbar-error'] });
  }
}
