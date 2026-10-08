package com.lavantien.flowershop.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;
import java.math.RoundingMode;

@ConfigurationProperties("shop")
public record ShopProperties(Delivery delivery, Payment payment) {

	public record Delivery(long baseFee, long perKm, long maxFee, long roundTo) {

		public Delivery {
			if (roundTo <= 0) {
				throw new IllegalStateException("shop.delivery.round-to must be positive: " + roundTo);
			}
			if (baseFee < 0 || perKm < 0 || maxFee < 0) {
				throw new IllegalStateException("shop.delivery fees must not be negative: base-fee " + baseFee
					+ ", per-km " + perKm + ", max-fee " + maxFee);
			}
			if (baseFee % roundTo != 0) {
				throw new IllegalStateException("shop.delivery.base-fee " + baseFee
					+ " is not a multiple of round-to " + roundTo);
			}
			if (maxFee % roundTo != 0) {
				throw new IllegalStateException("shop.delivery.max-fee " + maxFee
					+ " is not a multiple of round-to " + roundTo);
			}
		}

		public BigDecimal round(BigDecimal amount) {
			BigDecimal step = BigDecimal.valueOf(roundTo);
			return amount.divide(step, 0, RoundingMode.HALF_UP).multiply(step);
		}
	}

	public record Payment(String secret, String baseUrl) {}
}
