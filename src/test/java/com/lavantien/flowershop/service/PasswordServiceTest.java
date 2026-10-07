package com.lavantien.flowershop.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordServiceTest {
	private final PasswordService passwordService = new PasswordService();

	@Test
	void hashProducesBcryptDigestThatMatchesThePlaintext() {
		String hash = passwordService.hash("1234qwer");
		assertTrue(hash.startsWith("$2"), "expected a bcrypt digest, got: " + hash);
		assertTrue(passwordService.matches("1234qwer", hash));
	}

	@Test
	void matchesRejectsAWrongPassword() {
		String hash = passwordService.hash("1234qwer");
		assertFalse(passwordService.matches("12345678", hash));
	}

	@Test
	void hashSaltsSoTwoHashesOfTheSamePasswordDiffer() {
		assertNotEquals(passwordService.hash("1234qwer"), passwordService.hash("1234qwer"));
	}

	@Test
	void burnDummyComparisonToleratesANullPassword() {
		passwordService.burnDummyComparison(null);
	}
}
