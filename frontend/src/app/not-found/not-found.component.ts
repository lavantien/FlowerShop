import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'app-not-found',
	imports: [RouterLink, TranslatePipe],
	template: `
		<div class="text-center p-5">
			<h1 class="display-1">404</h1>
			<p>{{'NOT_FOUND.MESSAGE' | translate}}</p>
			<a class="btn btn-dark" routerLink="/shop">{{'NOT_FOUND.BACK' | translate}}</a>
		</div>
	`
})
export class NotFoundComponent {
}
