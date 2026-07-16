import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthApiService } from '../Services/auth-api-service';

export const ModalRedirectGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const router = inject(Router);
  const authSrv = inject(AuthApiService);

  const path = route.routeConfig?.path; // e.g. 'add-user', 'edit-user/:id', etc.
  if (!path) return true;

  // Extract base parameters
  let modalName = '';
  const queryParams: any = { ...route.queryParams };

  if (path === 'add-user') {
    modalName = 'add-user';
  } else if (path === 'add-department') {
    modalName = 'add-department';
  } else if (path === 'add-task') {
    modalName = 'add-task';
  } else if (path === 'edit-user/:id') {
    modalName = 'edit-user';
    queryParams['id'] = route.params['id'];
  } else if (path === 'edit-task') {
    modalName = 'edit-task';
    // taskId is already in queryParams
  } else if (path === 'edit-department/:id') {
    modalName = 'add-department';
    queryParams['id'] = route.params['id'];
  }

  if (!modalName) return true;

  // Set the modal query param
  queryParams['modal'] = modalName;

  // Find a target background page
  // If the user was already on a page (e.g. /view-tasks or /department/5), router.url will be that page.
  // If they refresh directly on the add/edit route, router.url might be '/' or match the modal route itself,
  // in which case we redirect to the role's dashboard as background.
  let targetUrl = router.url.split('?')[0];
  if (
    targetUrl === '/' ||
    targetUrl === '/login' ||
    targetUrl.includes('add-') ||
    targetUrl.includes('edit-')
  ) {
    const role = authSrv.getCurrentRole() || '';
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SUB_ADMIN') {
      targetUrl = '/admin';
    } else if (role === 'HOD') {
      targetUrl = '/hod';
    } else if (role === 'TEACHER') {
      targetUrl = '/teacher';
    } else {
      targetUrl = '/';
    }
  }

  console.log(`[ModalRedirectGuard] Redirecting navigation of /${path} to ${targetUrl} with modal: ${modalName}`, queryParams);

  // Navigate to target background URL with query params, merging them
  return router.createUrlTree([targetUrl], {
    queryParams,
    queryParamsHandling: 'merge'
  });
};
