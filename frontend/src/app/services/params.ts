import {HttpParams} from '@angular/common/http';

export function definedParams(values: Record<string, string | number | undefined>): HttpParams {
	let params = new HttpParams();
	for (const [key, value] of Object.entries(values)) {
		if (value !== undefined && value !== '') {
			params = params.set(key, value);
		}
	}
	return params;
}
