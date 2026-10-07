import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {NgxSpinnerService} from 'ngx-spinner';
import {catchError, finalize, retry, timeout} from 'rxjs/operators';
import {identity, throwError} from 'rxjs';
import {SessionService} from './session.service';
import {ToastService} from './toast.service';
import {isPaymentPath} from '../services/api';

const TIMEOUT_MS = 10000;
const RETRY_COUNT = 2;
const SESSION_EXPIRED = 'Session expired. Please sign in again.';

// v3 errors are problem+json bodies with a human readable detail line.
function problemDetail(error: HttpErrorResponse): string | undefined {
	const body: unknown = error.error;
	if (typeof body === 'object' && body !== null && 'detail' in body) {
		const detail = (body as {detail?: unknown}).detail;
		if (typeof detail === 'string' && detail !== '') {
			return detail;
		}
	}
	return undefined;
}

export const globalHttpInterceptor: HttpInterceptorFn = (req, next) => {
	const spinner = inject(NgxSpinnerService);
	const session = inject(SessionService);
	const toast = inject(ToastService);
	const token = session.token();
	if (token !== null) {
		req = req.clone({
			setHeaders: {
				'X-Auth-Token': token
			}
		});
	}
	spinner.show();
	return next(req).pipe(
		timeout(TIMEOUT_MS),
		// only reads may replay: a retried post could double-bill a checkout
		req.method === 'GET' ? retry(RETRY_COUNT) : identity,
		catchError((error: HttpErrorResponse) => {
			// A payment 401 means a bad or truncated sig on a public link, not a
			// dead session: the pay page surfaces its own error, so the interceptor
			// stays silent and keeps the session alive.
			if (error.status === 401 && isPaymentPath(req.url)) {
				return throwError(() => error);
			}
			if (error.status === 401) {
				session.logout();
				session.requestLogin();
				toast.danger(problemDetail(error) ?? SESSION_EXPIRED);
			} else {
				toast.danger(problemDetail(error) ?? `Request failed with status ${error.status}.`);
			}
			return throwError(() => error);
		}),
		finalize(() => {
			spinner.hide();
		}));
};
