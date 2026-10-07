import {Injectable, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';

export interface CityOption {
	name: string;
}

export interface DistrictOption {
	name: string;
	cityName: string;
}

@Injectable({providedIn: 'root'})
export class GeoOptionsService {
	private readonly http = inject(HttpClient);
	private readonly citiesSignal = signal<CityOption[]>([]);
	private readonly districtsSignal = signal<DistrictOption[]>([]);
	private loaded = false;

	readonly cities = this.citiesSignal.asReadonly();
	readonly districts = this.districtsSignal.asReadonly();

	load(): void {
		if (this.loaded) {
			return;
		}
		this.loaded = true;
		this.http.get<CityOption[]>('../assets/data/cities.json').subscribe({
			next: data => this.citiesSignal.set(data ?? []),
			error: () => this.citiesSignal.set([])
		});
		this.http.get<DistrictOption[]>('../assets/data/districts.json').subscribe({
			next: data => this.districtsSignal.set(data ?? []),
			error: () => this.districtsSignal.set([])
		});
	}
}
