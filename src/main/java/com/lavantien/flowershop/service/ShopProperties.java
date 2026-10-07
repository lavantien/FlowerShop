package com.lavantien.flowershop.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

// The single config hub: every tunable the shop needs lives here and in
// application.yml under the shop prefix, never as a stray constant.
@ConfigurationProperties("shop")
public record ShopProperties(Delivery delivery, Payment payment) {

	public record Delivery(long baseFee, long perKm, long maxFee, long roundTo) {}

	public record Payment(String secret, String baseUrl) {}
}
