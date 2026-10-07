package com.lavantien.flowershop;

import java.math.BigDecimal;
import java.util.Random;

// Deterministic bounded data for the property suites: a fixed seed makes every
// run feed the exact same cases, so a failure always reproduces and CI never
// flakes. No external property library, just java.util.Random.
public final class SeededGenerator {
	// Printable ASCII minus the chars that would quote-escape or break tokens.
	private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_.+";

	private final Random random;

	public SeededGenerator(long seed) {
		this.random = new Random(seed);
	}

	public int intBetween(int min, int maxInclusive) {
		return min + random.nextInt(maxInclusive - min + 1);
	}

	public long longBetween(long min, long maxInclusive) {
		return min + (long) (random.nextDouble() * (maxInclusive - min + 1));
	}

	public boolean flag() {
		return random.nextBoolean();
	}

	public BigDecimal wholeBetween(long min, long maxInclusive) {
		return BigDecimal.valueOf(longBetween(min, maxInclusive));
	}

	// A bounded decimal with the requested scale, e.g. scale 2 yields cents.
	public BigDecimal decimalBetween(long min, long maxInclusive, int scale) {
		return BigDecimal.valueOf(longBetween(min, maxInclusive), scale);
	}

	// A coordinate pair as {lat, lng} spanning the whole globe.
	public double[] coordinate() {
		return new double[] {random.nextDouble() * 180 - 90, random.nextDouble() * 360 - 180};
	}

	public String string(int maxLength) {
		int length = intBetween(1, maxLength);
		StringBuilder builder = new StringBuilder(length);
		for (int i = 0; i < length; i++) {
			builder.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
		}
		return builder.toString();
	}
}
