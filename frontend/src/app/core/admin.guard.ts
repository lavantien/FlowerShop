import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {SessionService} from './session.service';

export const adminGuard: CanActivateFn = () => {
	const session = inject(SessionService);
	const router = inject(Router);
	return session.isAdmin() ? true : router.createUrlTree(['/shop']);
};
