import {Component, OnInit, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {NgxSpinnerService} from 'ngx-spinner';

@Component({
	selector: 'app-test',
	templateUrl: './test.component.html',
	styleUrls: ['./test.component.scss']
})
export class TestComponent implements OnInit {
	tests = signal<Test[]>([]);
	timeOutHttpRequest = 2000;

	private readonly http = inject(HttpClient);
	private readonly spinner = inject(NgxSpinnerService);

	ngOnInit() {
		this.getTests();
	}

	getTests() {
		this.spinner.show();
		this.http.get<Test[]>('/api/test').subscribe(rs => {
			if (rs) {
				this.tests.set(rs);
			}
		});
	}
}

interface Test {
	id: number;
	name: string;
	detail: string;
	updateDate: Date;
}
