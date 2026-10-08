import {beforeEach, afterEach, describe, expect, it} from 'vitest';
import {SeededGenerator} from '../../testing/seeded-generator';
import {SessionService, SessionUser} from './session.service';

const member: SessionUser = {
	id: 4,
	name: 'Member',
	email: 'member@flowershop.example',
	phone: '0900000004',
	address: 'A',
	district: 'Binh Thanh',
	city: 'Ho Chi Minh',
	role: 'USER',
	enable: true
};

const admin: SessionUser = {...member, id: 1, role: 'ADMIN'};

function corruptPayloads(gen: SeededGenerator): string[] {
	const valid = JSON.stringify(member);
	const payloads: string[] = [
		'', '{', '}{', '[', 'null,', valid.slice(0, valid.length - 1),
		'null', 'true', 'false', '0', '-13', '1e999', '"text"', '[]', '[1,2]', '[[[[[]]]]]',
		JSON.stringify(gen.string(80))
	];
	for (let i = 0; i < 24; i++) {
		const depth = gen.intBetween(200, 5000);
		payloads.push('{"a":'.repeat(depth) + '1' + '}'.repeat(depth));
	}
	return payloads;
}

const nonFiniteIdJunk = [null, true, [], [4], {}, {id: 4}, '', '4', 'x'.repeat(64)];
const nonStringJunk = [null, 0, -1, 1.5, true, [], {}, [4], {id: 4}];
const nonRoleJunk = [null, 0, true, [], {}, '', 'admin', 'USER ', 'USER\x00', 'ADMINX', 'user'];

describe('SessionService fuzz', () => {
	let gen: SeededGenerator;

	beforeEach(() => {
		localStorage.clear();
		gen = new SeededGenerator();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('restores a valid stored session for both roles under generated token junk', () => {
		for (const user of [member, admin]) {
			const token = gen.string(40);
			localStorage.setItem('token', token);
			localStorage.setItem('user', JSON.stringify(user));
			const session = new SessionService();
			expect(session.isLoggedIn()).toBe(true);
			expect(session.user()).toEqual(user);
			expect(session.isAdmin()).toBe(user.role === 'ADMIN');
			expect(session.token()).toBe(token);
		}
	});

	it('drops every corrupt stored user without throwing and purges both keys', () => {
		for (const payload of corruptPayloads(gen)) {
			localStorage.clear();
			localStorage.setItem('token', 'token-1');
			localStorage.setItem('user', payload);
			const boot = (): SessionService => new SessionService();
			expect(boot).not.toThrow();
			const session = boot();
			expect(session.isLoggedIn()).toBe(false);
			expect(session.user()).toBeNull();
			expect(session.token()).toBeNull();
			expect(localStorage.getItem('token')).toBeNull();
			expect(localStorage.getItem('user')).toBeNull();
		}
	});

	it('rejects a valid shaped user whose guarded field carries generated junk', () => {
		const junkByField: Record<string, unknown[]> = {
			id: nonFiniteIdJunk,
			name: nonStringJunk,
			email: nonStringJunk,
			role: nonRoleJunk
		};
		for (const [field, junk] of Object.entries(junkByField)) {
			for (const value of junk) {
				localStorage.clear();
				localStorage.setItem('token', 'token-1');
				const candidate = JSON.parse(JSON.stringify(member)) as Record<string, unknown>;
				candidate[field] = value;
				localStorage.setItem('user', JSON.stringify(candidate));
				const session = new SessionService();
				expect(session.isLoggedIn(), `${field}=${JSON.stringify(value)}`).toBe(false);
				expect(localStorage.getItem('token')).toBeNull();
			}
		}
	});

	it('still restores when unvalidated profile fields are odd but well typed', () => {
		for (let i = 0; i < 50; i++) {
			localStorage.clear();
			localStorage.setItem('token', 'token-1');
			const candidate = JSON.parse(JSON.stringify(member)) as Record<string, unknown>;
			candidate['phone'] = gen.flag() ? '' : gen.string(20);
			candidate['address'] = gen.string(30);
			candidate['enable'] = gen.flag();
			localStorage.setItem('user', JSON.stringify(candidate));
			expect(new SessionService().isLoggedIn()).toBe(true);
		}
	});

	it('keeps the stored token untouched when no user was ever stored', () => {
		const token = gen.string(30);
		localStorage.setItem('token', token);
		const session = new SessionService();
		expect(session.isLoggedIn()).toBe(false);
		expect(session.token()).toBeNull();
		expect(localStorage.getItem('token')).toBe(token);
	});

	it('ignores generated junk stored under unrelated keys', () => {
		for (let i = 0; i < 60; i++) {
			localStorage.clear();
			localStorage.setItem('junk-' + gen.string(10), gen.string(60));
			localStorage.setItem('user', JSON.stringify(admin));
			localStorage.setItem('token', 'token-1');
			const session = new SessionService();
			expect(session.isLoggedIn()).toBe(true);
			expect(session.isAdmin()).toBe(true);
		}
	});
});
