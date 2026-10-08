package com.lavantien.flowershop.api.coupon;

import com.lavantien.flowershop.SeededGenerator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CouponDiscountPropertyTest {
	private static final long SEED = 20261009L;

	private final SeededGenerator gen = new SeededGenerator(SEED);

	private static Coupon coupon(CouponKind kind, long value) {
		Coupon coupon = new Coupon("PROP", kind, BigDecimal.valueOf(value), true, null);
		coupon.setId(1L);
		return coupon;
	}

	private static long percentOracle(long subtotal, long rate) {
		return Math.min((subtotal * rate + 99) / 100, subtotal);
	}

	private static BigDecimal percentOracle(BigDecimal subtotal, long rate) {
		long cents = subtotal.movePointRight(2).longValueExact();
		long ceiled = (cents * rate + 9999) / 10000;
		return BigDecimal.valueOf(ceiled).min(subtotal);
	}

	@Test
	void percentDiscountMatchesTheCeilingAndCapFormulaAndNeverExceedsTheSubtotal() {
		for (int i = 0; i < 500; i++) {
			long rate = gen.longBetween(1, 100);
			long subtotal = gen.flag() ? gen.longBetween(0, 1000) : gen.longBetween(0, 50_000_000);
			BigDecimal discount = coupon(CouponKind.PERCENT, rate).discountOn(BigDecimal.valueOf(subtotal));

			assertTrue(discount.compareTo(BigDecimal.ZERO) >= 0, "negative discount at subtotal " + subtotal);
			assertTrue(discount.compareTo(BigDecimal.valueOf(subtotal)) <= 0,
				"discount " + discount + " exceeds subtotal " + subtotal);
			assertEquals(0, discount.scale(), "discount must be whole dong, got scale " + discount.scale());
			assertEquals(percentOracle(subtotal, rate), discount.longValueExact(),
				"percent formula drift at subtotal " + subtotal + " rate " + rate);
		}
	}

	@Test
	void percentDiscountHoldsForFractionalPreviewSubtotals() {
		for (int i = 0; i < 300; i++) {
			long rate = gen.longBetween(1, 100);
			BigDecimal subtotal = gen.decimalBetween(1, 5_000_000_00L, 2);
			BigDecimal discount = coupon(CouponKind.PERCENT, rate).discountOn(subtotal);

			assertTrue(discount.compareTo(BigDecimal.ZERO) >= 0, "negative discount at subtotal " + subtotal);
			assertTrue(discount.compareTo(subtotal) <= 0,
				"discount " + discount + " exceeds subtotal " + subtotal);
			assertEquals(0, percentOracle(subtotal, rate).compareTo(discount),
				"percent formula drift at subtotal " + subtotal + " rate " + rate);
		}
	}

	@Test
	void fixedDiscountClampsAtTheSubtotalAndNeverGoesNegative() {
		for (int i = 0; i < 400; i++) {
			long value = gen.longBetween(1, 200_000);
			BigDecimal subtotal = gen.flag()
				? BigDecimal.valueOf(gen.longBetween(0, 1000))
				: gen.decimalBetween(1, 5_000_000_00L, 2);
			BigDecimal discount = coupon(CouponKind.FIXED, value).discountOn(subtotal);

			BigDecimal expected = BigDecimal.valueOf(value).min(subtotal);
			assertTrue(discount.compareTo(BigDecimal.ZERO) >= 0, "negative discount at subtotal " + subtotal);
			assertEquals(0, expected.compareTo(discount),
				"fixed discount must clamp to the subtotal, got " + discount + " for " + subtotal);
			assertTrue(discount.compareTo(subtotal) <= 0, "fixed discount " + discount + " exceeds " + subtotal);
		}
	}
}
