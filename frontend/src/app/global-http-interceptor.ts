import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {NgxSpinnerService} from 'ngx-spinner';
import {catchError, finalize, retry, timeout} from 'rxjs/operators';
import {identity, throwError} from 'rxjs';

const TIMEOUT_MS = 10000;
const RETRY_COUNT = 2;

export const globalHttpInterceptor: HttpInterceptorFn = (req, next) => {
	const spinner = inject(NgxSpinnerService);
	const token = localStorage.getItem('token');
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
			// TODO: Add error handling logic here
			console.log(`HTTP Error ${error.status}: ${req.url}`);
			return throwError(() => error);
		}),
		finalize(() => {
			spinner.hide();
		}));
};
