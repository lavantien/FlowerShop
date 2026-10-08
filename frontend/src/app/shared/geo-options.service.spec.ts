import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {GeoOptionsService} from './geo-options.service';

describe('GeoOptionsService', () => {
	let httpMock: HttpTestingController;
	let geo: GeoOptionsService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()]
		});
		httpMock = TestBed.inject(HttpTestingController);
		geo = TestBed.inject(GeoOptionsService);
	});

	afterEach(() => {
		httpMock.verify();
		TestBed.resetTestingModule();
	});

	it('loads the city and district assets once', () => {
		geo.load();
		httpMock.expectOne('../assets/data/cities.json').flush([{name: 'Ho Chi Minh'}]);
		httpMock.expectOne('../assets/data/districts.json')
			.flush([{name: 'Binh Thanh', cityName: 'Ho Chi Minh'}]);
		expect(geo.cities()).toEqual([{name: 'Ho Chi Minh'}]);
		expect(geo.districts()).toEqual([{name: 'Binh Thanh', cityName: 'Ho Chi Minh'}]);

		geo.load();
		geo.load();
		expect(httpMock.match(() => true)).toHaveLength(0);
	});

	it('falls back to empty lists when the assets fail', () => {
		geo.load();
		httpMock.expectOne('../assets/data/cities.json').flush('boom', {status: 500, statusText: 'Server Error'});
		httpMock.expectOne('../assets/data/districts.json').flush('boom', {status: 500, statusText: 'Server Error'});
		expect(geo.cities()).toEqual([]);
		expect(geo.districts()).toEqual([]);
	});

	it('treats null payloads as empty', () => {
		geo.load();
		httpMock.expectOne('../assets/data/cities.json').flush(null);
		httpMock.expectOne('../assets/data/districts.json').flush(null);
		expect(geo.cities()).toEqual([]);
		expect(geo.districts()).toEqual([]);
	});
});
