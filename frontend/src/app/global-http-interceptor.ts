import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {NgxSpinnerService} from 'ngx-spinner';
import {catchError, finalize, retry, timeout} from 'rxjs/operators';
import {throwError} from 'rxjs';

export const globalHttpInterceptor: HttpInterceptorFn = (req, next) => {
	const spinner = inject(NgxSpinnerService);
	// Add Auth Token
	const hardcodedToken = 'VUlULiBTRTM0Ny5LMTEuUE1DTCAtIEdWLiBUcmFuIEFuaCBEdW5nLiBOaG9tIDEgLSBMYSBWYW4gVGllbiwgTmd1eWVuIFR1YW4gUGh1b25nIE5hbSwgTGUgVmlldCBIdW5uaC4=';
	req = req.clone({
		setHeaders: {
			Authorization: `Basic ${hardcodedToken}`
		}
	});
	spinner.show();
	return next(req).pipe(
		timeout(3000),
		retry(2),
		catchError((error: HttpErrorResponse) => {
			// TODO: Add error handling logic here
			console.log(`HTTP Error ${error.status}: ${req.url}`);
			return throwError(() => error);
		}),
		// PROFILING
		finalize(() => {
			// const profilingMsg = `${req.method} "${req.urlWithParams}"`;
			// console.log(profilingMsg);
			spinner.hide();
		}));
};
