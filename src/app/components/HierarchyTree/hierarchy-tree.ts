import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { UserApiService } from '../../Services/UserApiService';
import { userDto } from '../../Model/userDto';
import { JwtService } from '../../Services/jwt-service';

interface TreeNode {
  user: userDto;
  children: TreeNode[];
}

@Component({
  selector: 'app-hierarchy-tree',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hierarchy-tree.html',
  styleUrls: ['./hierarchy-tree.css']
})
export class HierarchyViewerComponent implements OnInit {
  users: userDto[] = [];
  treeRoots: TreeNode[] = [];
  selectedUser: userDto | null = null;
  loading = false;

  constructor(
    private userApiService: UserApiService,
    private router: Router,
    private jwtService: JwtService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.buildHierarchy();
  }

  buildHierarchy(): void {
    this.loading = true;
    this.userApiService.getAllUsers().subscribe({
      next: (usersList) => {
        this.users = Array.isArray(usersList) ? usersList : [];
        this.treeRoots = this.constructTree(this.users);
        this.loading = false;
        
        // Auto-select logged-in user by default
        const token = this.jwtService.getAccessToken();
        if (token) {
          const currentUserId = this.jwtService.getUserIdFromToken(token);
          if (currentUserId) {
            const currentUser = this.users.find(u => u.userId === currentUserId);
            if (currentUser) {
              this.selectUser(currentUser);
            }
          }
        }
      },
      error: (err) => {
        console.error('Failed to build user hierarchy', err);
        this.loading = false;
      }
    });
  }

  constructTree(users: userDto[]): TreeNode[] {
    if (!Array.isArray(users) || users.length === 0) {
      return [];
    }
    const nodeMap = new Map<number, TreeNode>();
    
    // Create tree nodes for all users
    users.forEach(u => {
      if (!u || typeof u.userId !== 'number') return;
      nodeMap.set(u.userId, { user: u, children: [] });
    });

    const roots: TreeNode[] = [];

    // Link parents and children
    users.forEach(u => {
      if (!u || typeof u.userId !== 'number') return;
      const node = nodeMap.get(u.userId)!;
      const managerIds = u.reportingManagerIds || (u.parentUserId ? [u.parentUserId] : []);

      let hasActiveParentInSystem = false;
      managerIds.forEach(managerId => {
        if (managerId && nodeMap.has(managerId)) {
          const parentNode = nodeMap.get(managerId)!;
          if (!parentNode.children.includes(node)) {
            parentNode.children.push(node);
          }
          hasActiveParentInSystem = true;
        }
      });

      if (!hasActiveParentInSystem) {
        // Roots are users with no parent, or parent not in the system
        roots.push(node);
      }
    });

    // Sort roots and child collections by role level if available
    const sortByRoleLevel = (a: TreeNode, b: TreeNode) => {
      const roleLevels: { [key: string]: number } = {
        'SUPER_ADMIN': 1,
        'ADMIN': 2,
        'SUB_ADMIN': 3,
        'HOD': 4,
        'TEACHER': 5
      };
      const levelA = roleLevels[(a.user.role || '').toUpperCase()] || 10;
      const levelB = roleLevels[(b.user.role || '').toUpperCase()] || 10;
      return levelA - levelB;
    };

    roots.sort(sortByRoleLevel);
    nodeMap.forEach(node => {
      node.children.sort(sortByRoleLevel);
    });

    return roots;
  }

  selectUser(u: userDto): void {
    if (!u || typeof u.userId !== 'number') return;
    // Eagerly fetch complete profile from backend to get calculated effective permissions list
    this.userApiService.getUserById(u.userId).subscribe({
      next: (detailedUser) => {
        this.selectedUser = detailedUser;
      },
      error: (err) => {
        console.error('Failed to fetch user permissions scope', err);
        this.selectedUser = u; // fallback
      }
    });
  }

  getRoleColor(role: string): string {
    const r = (role || '').toUpperCase();
    switch (r) {
      case 'SUPER_ADMIN': return 'primary';
      case 'ADMIN': return 'indigo';
      case 'SUB_ADMIN': return 'warning';
      case 'HOD': return 'success';
      case 'TEACHER': return 'secondary';
      default: return 'dark';
    }
  }

  getRoleIcon(role: string): string {
    const r = (role || '').toUpperCase();
    switch (r) {
      case 'SUPER_ADMIN': return 'bi-shield-fill-check';
      case 'ADMIN': return 'bi-shield-check';
      case 'SUB_ADMIN': return 'bi-person-check-fill';
      case 'HOD': return 'bi-award-fill';
      case 'TEACHER': return 'bi-book-half';
      default: return 'bi-person-fill';
    }
  }

  getPrimaryDepartmentName(u: userDto): string {
    return u.departmentNames && u.departmentNames.length > 0 ? u.departmentNames[0] : 'None';
  }

  viewUser(userId: number): void {
    this.router.navigate(['/user', userId]);
  }

  goBack(): void {
    this.location.back();
  }
}
