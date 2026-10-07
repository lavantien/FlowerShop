// Deterministic data for the fuzz specs, the SeededGenerator pattern of the
// backend property suites: a fixed seed makes every run feed the exact same
// cases, so a failure always reproduces and CI never flakes. No external
// property library, just an inline mulberry32 generator.
export const FUZZ_SEED = 20261007;

// Printable ASCII plus diacritics and CJK so generated junk stresses json
// round trips and string handling the way the backend corpus does.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_.+{}[]":,\\ăâđêôơư中文🌸';

export class SeededGenerator {
	private state: number;

	constructor(seed: number = FUZZ_SEED) {
		this.state = seed >>> 0;
	}

	next(): number {
		this.state = (this.state + 0x6d2b79f5) >>> 0;
		let t = this.state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	intBetween(min: number, maxInclusive: number): number {
		return min + Math.floor(this.next() * (maxInclusive - min + 1));
	}

	flag(): boolean {
		return this.next() < 0.5;
	}

	pick<T>(values: readonly T[]): T {
		return values[this.intBetween(0, values.length - 1)];
	}

	string(maxLength: number): string {
		const length = this.intBetween(1, maxLength);
		let result = '';
		for (let i = 0; i < length; i++) {
			result += ALPHABET[this.intBetween(0, ALPHABET.length - 1)];
		}
		return result;
	}
}
