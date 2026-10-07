package com.lavantien.flowershop.api.security;

import com.lavantien.flowershop.SeededGenerator;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Property view of the token pair Auth.mintToken / Auth.parseSession plus the
// UserService session store they ride on: every login round-trips through the
// store, and a seeded bit flip at every payload byte position of a valid token
// either breaks parsing or names a session the store rejects.
class TokenTamperPropertyTest {
	private static final long SEED = 20261010L;

	private final SeededGenerator gen = new SeededGenerator(SEED);
	private final UserService sessions = new UserService();

	private long id() {
		return gen.longBetween(1, 1_000_000);
	}

	private Role role() {
		return gen.flag() ? Role.USER : Role.ADMIN;
	}

	@Test
	void everyLoginRoundTripsThroughTheSessionStore() {
		for (int i = 0; i < 100; i++) {
			long id = id();
			Role role = role();
			String secret = sessions.login(id);
			String token = Auth.mintToken(id, role, secret);

			Auth.Session parsed = Auth.parseSession(token);
			assertEquals(new Auth.Session(id, role, secret), parsed, "mint and parse disagree for id " + id);
			assertTrue(sessions.hasSession(parsed.id(), parsed.secret()),
				"the store must accept the session the token encodes");

			sessions.logout(id, secret);
			assertFalse(sessions.hasSession(id, secret), "logout must kill the session");
			assertThrows(IllegalArgumentException.class, () -> Auth.parseSession(token + "x"));
		}
	}

	@Test
	void aSecondLoginRetiresThePreviousSecret() {
		for (int i = 0; i < 50; i++) {
			long id = id();
			String first = sessions.login(id);
			String second = sessions.login(id);

			assertTrue(sessions.hasSession(id, second));
			assertFalse(sessions.hasSession(id, first), "the older token must die on re-login");
		}
	}

	@Test
	void seededBitFlipsOnEveryPayloadByteAreRejected() {
		for (int i = 0; i < 25; i++) {
			long id = id();
			Role role = role();
			String secret = sessions.login(id);
			Auth.Session original = new Auth.Session(id, role, secret);
			byte[] payload = Base64.getDecoder().decode(Auth.mintToken(id, role, secret));

			for (int position = 0; position < payload.length; position++) {
				int mask = 1 << gen.intBetween(0, 7);
				payload[position] ^= (byte) mask;
				String tampered = Base64.getEncoder().encodeToString(payload);

				// A flipped byte changes exactly one character of id+ROLE+secret,
				// so a surviving parse can never restate the original session;
				// the store, holding only real logins, must refuse it.
				Auth.Session parsed;
				try {
					parsed = Auth.parseSession(tampered);
				} catch (IllegalArgumentException rejected) {
					parsed = null;
				}
				if (parsed != null) {
					assertFalse(original.equals(parsed) || sessions.hasSession(parsed.id(), parsed.secret()),
						"tampered token " + tampered + " survives as a live session");
				}
				payload[position] ^= (byte) mask;
			}
		}
	}
}
