import {Observable, throwError} from 'rxjs';
import * as XLSX from 'xlsx';
import {ProductInput, ProductView} from '../../models';

// The v3 product wire columns, shared by the import header mapping and the
// export worksheet so both sides of the excel flow always agree.
export const EXPORT_COLUMNS = ['id', 'name', 'description', 'imgUrl', 'price', 'typeName', 'categoryName'];

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function buildExportFilename(lang: string, date: Date): string {
	const name = lang === 'vi' ? 'sản_phẩm' : 'data';
	return `${name}__${date.toLocaleDateString(lang)}__${date.toLocaleTimeString(lang)}.xlsx`;
}

function isExcelFile(file: File): boolean {
	return file.type === XLSX_MIME;
}

// reads an uploaded workbook as product rows; errors carry the toast key
// suffix 'not-excel' or 'wrong-format' so the caller stays presentation only
export function readExcel(file: File | null): Observable<ProductInput[]> {
	if (file === null || !isExcelFile(file)) {
		return throwError(() => 'not-excel');
	}
	return new Observable<ProductInput[]>(observer => {
		const reader = new FileReader();
		reader.onload = () => {
			const workbook = XLSX.read(reader.result, {type: 'array'});
			const sheet = workbook.Sheets[workbook.SheetNames[0]];
			// the explicit header maps row cells to fields, so the human header
			// row arrives as data and slice(1) drops it: imports start at row 2
			const rows = XLSX.utils.sheet_to_json<ProductInput>(sheet, {header: [...EXPORT_COLUMNS]}).slice(1);
			if (rows.length === 0) {
				observer.error('wrong-format');
				return;
			}
			observer.next(rows);
			observer.complete();
		};
		reader.onerror = () => observer.error('not-excel');
		reader.readAsArrayBuffer(file);
	});
}

export function writeExportWorkbook(rows: ProductView[], lang: string): void {
	const worksheet = XLSX.utils.json_to_sheet(rows, {header: [...EXPORT_COLUMNS]});
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, lang === 'vi' ? 'Sản phẩm' : 'Products');
	XLSX.writeFile(workbook, buildExportFilename(lang, new Date()));
}
