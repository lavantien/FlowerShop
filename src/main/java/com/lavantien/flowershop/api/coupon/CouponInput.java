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

	Coupon toEntity() {
		Coupon coupon = new Coupon();
		applyTo(coupon);
		return coupon;
	}

	void applyTo(Coupon coupon) {
		coupon.setCode(code.strip());
		coupon.setKind(kind);
		coupon.setValue(value.setScale(0, RoundingMode.CEILING));
		if (active != null) {
			coupon.setActive(active);
		}
		coupon.setExpiresAt(expiresAt);
	}
}
