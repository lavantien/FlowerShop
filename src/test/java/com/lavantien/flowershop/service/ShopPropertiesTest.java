package com.lavantien.flowershop.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// The delivery tunables are bound at startup, so a misconfigured grid must
// fail the boot, not silently produce fees above the cap.
class ShopPropertiesTest {

	@Test
	void deliveryRejectsAFeeCapOffTheStepGrid() {
		IllegalStateException blown = assertThrows(IllegalStateException.class,
			() -> new ShopProperties.Delivery(20000, 5000, 20500, 1000));
		assertTrue(blown.getMessage().contains("max-fee"), "the message must name the offending field");
	}

	@Test
	void deliveryRejectsABaseFeeOffTheStepGrid() {
		IllegalStateException blown = assertThrows(IllegalStateException.class,
			() -> new ShopProperties.Delivery(20250, 5000, 200000, 1000));
		assertTrue(blown.getMessage().contains("base-fee"), "the message must name the offending field");
	}

	@Test
	void deliveryRejectsANonPositiveStep() {
		assertThrows(IllegalStateException.class, () -> new ShopProperties.Delivery(20000, 5000, 200000, 0));
		assertThrows(IllegalStateException.class, () -> new ShopProperties.Delivery(20000, 5000, 200000, -1000));
	}

	@Test
	void deliveryRejectsNegativeFees() {
		assertThrows(IllegalStateException.class, () -> new ShopProperties.Delivery(-20000, 5000, 200000, 1000));
		assertThrows(IllegalStateException.class, () -> new ShopProperties.Delivery(20000, -5000, 200000, 1000));
		assertThrows(IllegalStateException.class, () -> new ShopProperties.Delivery(20000, 5000, -200000, 1000));
	}

	@Test
	void deliveryAcceptsStepAlignedTunables() {
		assertDoesNotThrow(() -> new ShopProperties.Delivery(20000, 5000, 200000, 1000));
		assertDoesNotThrow(() -> new ShopProperties.Delivery(15000, 3500, 150000, 500));
		assertDoesNotThrow(() -> new ShopProperties.Delivery(0, 0, 0, 1000));
	}

	@Test
	void deliveryAcceptsAWholeDongStep() {
		// Step 1 is the finest legal grid: the positivity boundary must stop at
		// zero, not swallow the whole-dong step.
		ShopProperties.Delivery wholeDong
			= assertDoesNotThrow(() -> new ShopProperties.Delivery(20000, 5000, 200000, 1));
		assertEquals(0, BigDecimal.valueOf(255000).compareTo(wholeDong.round(BigDecimal.valueOf(255000))),
			"a step of 1 rounds every whole dong to itself");
	}
}
