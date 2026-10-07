import {registerLocaleData} from '@angular/common';
import localeEn from '@angular/common/locales/en';
import localeVi from '@angular/common/locales/vi';

// Locale data behind the CurrencyPipe and DatePipe. Imported once from
// app.config so every surface can format money and dates for vi and en.
registerLocaleData(localeEn);
registerLocaleData(localeVi);
