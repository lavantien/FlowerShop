import {createRequire} from 'node:module';
const require = createRequire('C:/Users/lavantien/dev/github/FlowerShop/frontend/package.json');
const ts = require('typescript');
const text = 'const url = `https://img/${name.toLowerCase()}`;\nconst y = 1; // tail\n';
const scanner = ts.createScanner(ts.ScriptTarget.Latest, false);
scanner.setText(text);
let token;
while ((token = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
	console.log(ts.SyntaxKind[token], JSON.stringify(text.slice(scanner.getTokenStart(), scanner.getTextPos())));
}
