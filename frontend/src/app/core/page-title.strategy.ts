import {Injectable, inject} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {RouterStateSnapshot, TitleStrategy} from '@angular/router';

const APP_NAME = 'FlowerShop';

@Injectable()
export class PageTitleStrategy extends TitleStrategy {
	private readonly title = inject(Title);

	override updateTitle(routerState: RouterStateSnapshot): void {
		const routeTitle = this.buildTitle(routerState);
		this.title.setTitle(routeTitle === undefined ? APP_NAME : `${routeTitle} - ${APP_NAME}`);
	}
}
