package com.lavantien.flowershop.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;
import java.math.RoundingMode;

// The single config hub: every tunable the shop needs lives here and in
// application.yml under the shop prefix, never as a stray constant.
@ConfigurationProperties("shop")
public record ShopProperties(Delivery delivery, Payment payment) {

	public record Delivery(long baseFee, long perKm, long maxFee, long roundTo) {

		// Every computed money amount lands on the round-to step, HALF_UP.
		public BigDecimal round(BigDecimal amount) {
			BigDecimal step = BigDecimal.valueOf(roundTo);
			return amount.divide(step, 0, RoundingMode.HALF_UP).multiply(step);
		}
	}

	public record Payment(String secret, String baseUrl) {}
}
