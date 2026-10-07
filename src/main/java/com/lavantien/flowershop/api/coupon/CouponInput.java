package com.lavantien.flowershop.api.coupon;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

@PercentCap
public record CouponInput(@NotBlank String code, @NotNull CouponKind kind,
	@NotNull @Positive BigDecimal value, Boolean active, Instant expiresAt) {

	// Fixed values are whole dong and percent rates stay integral; the
	// ceiling keeps any accepted positive fraction from rounding to zero.
	Coupon toEntity() {
		Coupon coupon = new Coupon();
		applyTo(coupon);
		return coupon;
	}

	void applyTo(Coupon coupon) {
		coupon.setCode(code.strip());
		coupon.setKind(kind);
		coupon.setValue(value.setScale(0, RoundingMode.CEILING));
		// An omitted active keeps the stored flag on updates and rides the
		// entity's true default on creates.
		if (active != null) {
			coupon.setActive(active);
		}
		coupon.setExpiresAt(expiresAt);
	}
}
