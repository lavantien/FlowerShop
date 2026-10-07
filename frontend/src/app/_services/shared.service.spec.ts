import {firstValueFrom} from 'rxjs';
import {describe, expect, it} from 'vitest';
import {SharedService} from './shared.service';

describe('SharedService', () => {
	const service = new SharedService();

	it('starts with the light theme', async () => {
		expect(await firstValueFrom(service.getGlobalBackgroundPrimary())).toEqual(['bg-light', 'text-dark']);
	});

	it('emits each theme pushed through updateGlobalBackgroundPrimary', () => {
		const emissions: [string, string][] = [];
		service.getGlobalBackgroundPrimary().subscribe(theme => emissions.push(theme));
		service.updateGlobalBackgroundPrimary(['bg-dark', 'text-white']);
		expect(emissions).toEqual([['bg-light', 'text-dark'], ['bg-dark', 'text-white']]);
	});
});
