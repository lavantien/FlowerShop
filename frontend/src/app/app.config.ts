import {ApplicationConfig, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {provideRouter, TitleStrategy} from '@angular/router';
import {provideTranslateService} from '@ngx-translate/core';
import {provideTranslateHttpLoader} from '@ngx-translate/http-loader';

import {routes} from './app.routes';
import {PageTitleStrategy} from './core/page-title.strategy';
import {globalHttpInterceptor} from './core/global-http-interceptor';

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes),
		provideHttpClient(withInterceptors([globalHttpInterceptor])),
		provideAnimationsAsync(),
		{provide: TitleStrategy, useClass: PageTitleStrategy},
		provideTranslateService({fallbackLang: 'en'}),
		provideTranslateHttpLoader(),
	],
};
