package com.lavantien.flowershop.service;

import com.lavantien.flowershop.SeededGenerator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Property view of GeoService.deliveryFee: whatever the distance and the
// delivery tunables, the fee is a whole step, never above the cap, never
// decreasing as the cart travels further, and always the plan formula
// min(base + perKm * km, maxFee) rounded HALF_UP to the step.
class DeliveryFeePropertyTest {
	private static final long SEED = 20261007L;
	private static final int CASES_PER_CONFIG = 300;

	private final SeededGenerator gen = new SeededGenerator(SEED);
	private final GeoService geoService = new GeoService(canonicalProperties());

	private static ShopProperties canonicalProperties() {
		return new ShopProperties(new ShopProperties.Delivery(20000, 5000, 200000, 1000),
			new ShopProperties.Payment("dev-only-secret", "/pay"));
	}

	private static long feeOracle(long base, long perKm, long maxFee, long roundTo, double km) {
		BigDecimal raw = BigDecimal.valueOf(base)
			.add(BigDecimal.valueOf(perKm).multiply(BigDecimal.valueOf(km)))
			.min(BigDecimal.valueOf(maxFee));
		return raw.divide(BigDecimal.valueOf(roundTo), 0, RoundingMode.HALF_UP)
			.multiply(BigDecimal.valueOf(roundTo)).longValueExact();
	}

	// Distances mix the tenth-of-a-km grid checkout really sees with raw
	// doubles, zero, and distances far past the cap.
	private double distance() {
		return switch (gen.intBetween(0, 3)) {
			case 0 -> gen.intBetween(0, 5000) / 10.0;
			case 1 -> gen.longBetween(0, 500);
			case 2 -> 0.0;
			default -> gen.longBetween(500, 5000);
		};
	}

	@Test
	void feeIsAlwaysAWholeStepBelowTheCapAndMatchesTheFormula() {
		ShopProperties.Delivery canonical = new ShopProperties.Delivery(20000, 5000, 200000, 1000);
		for (ShopProperties.Delivery delivery : new ShopProperties.Delivery[] {canonical,
			// Alternate tunables; maxFee stays a multiple of roundTo so the cap
			// survives the final rounding, exactly like the production numbers.
			new ShopProperties.Delivery(15000, 3500, 150000, 500),
			new ShopProperties.Delivery(30000, 7000, 300000, 2000)}) {
			GeoService service = new GeoService(new ShopProperties(delivery,
				new ShopProperties.Payment("dev-only-secret", "/pay")));
			for (int i = 0; i < CASES_PER_CONFIG; i++) {
				double km = distance();
				long fee = service.deliveryFee(km);
				long roundTo = delivery.roundTo();
				assertTrue(fee >= 0, "negative fee for " + km + " km: " + fee);
				assertEquals(0, fee % roundTo, "fee " + fee + " for " + km + " km is not a multiple of " + roundTo);
				assertTrue(fee <= delivery.maxFee(), "fee " + fee + " for " + km + " km passes the cap");
				assertEquals(feeOracle(delivery.baseFee(), delivery.perKm(), delivery.maxFee(), roundTo, km), fee,
					"formula drift for " + km + " km under " + delivery);
			}
		}
	}

	@Test
	void feeNeverDecreasesAsTheDistanceGrows() {
		for (int i = 0; i < CASES_PER_CONFIG; i++) {
			double shorter = distance();
			double longer = shorter + gen.longBetween(0, 400) / 10.0;
			long cheap = geoService.deliveryFee(shorter);
			long dear = geoService.deliveryFee(longer);
			assertTrue(cheap <= dear, "fee dropped from " + cheap + " to " + dear
				+ " between " + shorter + " km and " + longer + " km");
		}
	}
}
