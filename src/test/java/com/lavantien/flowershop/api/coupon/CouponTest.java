package com.lavantien.flowershop.api.coupon;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CouponTest {

	private static Coupon coupon(CouponKind kind, String value, boolean active, Instant expiresAt) {
		Coupon coupon = new Coupon("WELCOME10", kind, new BigDecimal(value), active, expiresAt);
		coupon.setId(1L);
		return coupon;
	}

	@Test
	void percentDiscountCeilsToWholeDong() {
		Coupon coupon = coupon(CouponKind.PERCENT, "33", true, null);

		assertEquals(0, new BigDecimal("330").compareTo(coupon.discountOn(new BigDecimal("999"))));
	}

	@Test
	void percentDiscountIsExactWhenDivisible() {
		Coupon coupon = coupon(CouponKind.PERCENT, "10", true, null);

		assertEquals(0, new BigDecimal("25000").compareTo(coupon.discountOn(new BigDecimal("250000"))));
	}

	@Test
	void percentDiscountCapsAtTheSubtotal() {
		Coupon coupon = coupon(CouponKind.PERCENT, "100", true, null);

		assertEquals(0, new BigDecimal("999").compareTo(coupon.discountOn(new BigDecimal("999"))));
	}

	@Test
	void fixedDiscountStaysVerbatimBelowTheSubtotal() {
		Coupon coupon = coupon(CouponKind.FIXED, "50000", true, null);

		assertEquals(0, new BigDecimal("50000").compareTo(coupon.discountOn(new BigDecimal("100000"))));
	}

	@Test
	void fixedDiscountClampsAtTheSubtotal() {
		Coupon coupon = coupon(CouponKind.FIXED, "50000", true, null);

		assertEquals(0, new BigDecimal("30000").compareTo(coupon.discountOn(new BigDecimal("30000"))));
	}

	@Test
	void toStringRendersEveryField() {
		Coupon coupon = coupon(CouponKind.PERCENT, "10", false, Instant.parse("2027-01-01T00:00:00Z"));

		assertTrue(coupon.toString().contains("code='WELCOME10'"), "toString must render the code");
		assertTrue(coupon.toString().contains("kind=PERCENT"), "toString must render the kind");
		assertTrue(coupon.toString().contains("value=10"), "toString must render the value");
		assertTrue(coupon.toString().contains("active=false"), "toString must render the flag");
		assertTrue(coupon.toString().contains("expiresAt=2027-01-01T00:00:00Z"), "toString must render expiry");
	}
}
