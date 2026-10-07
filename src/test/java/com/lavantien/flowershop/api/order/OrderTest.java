package com.lavantien.flowershop.api.order;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderTest {
	private static Order order() {
		return new Order(4L, "0900000001", "01 Demo Lane", "Quận 1", "Hồ Chí Minh", 3L, 4.2,
			BigDecimal.valueOf(40000), null, BigDecimal.ZERO, BigDecimal.valueOf(350000),
			BigDecimal.valueOf(390000));
	}

	@Test
	void transitionLandsEachStatusInItsOwnTimestampSlot() {
		Instant paid = Instant.parse("2026-10-07T04:00:00Z");
		Instant shipped = Instant.parse("2026-10-07T05:00:00Z");
		Instant completed = Instant.parse("2026-10-07T06:00:00Z");
		Instant cancelled = Instant.parse("2026-10-07T07:00:00Z");

		Order order = order();
		assertEquals(OrderStatus.PENDING, order.getStatus());
		assertNull(order.getPaidAt());

		order.transitionTo(OrderStatus.PAID, paid);
		assertEquals(paid, order.getPaidAt());
		assertNull(order.getShippedAt());

		order.transitionTo(OrderStatus.SHIPPED, shipped);
		assertEquals(shipped, order.getShippedAt());
		assertNull(order.getCompletedAt());

		order.transitionTo(OrderStatus.COMPLETED, completed);
		assertEquals(completed, order.getCompletedAt());
		assertEquals(paid, order.getPaidAt());

		Order fresh = order();
		fresh.transitionTo(OrderStatus.CANCELLED, cancelled);
		assertEquals(cancelled, fresh.getCancelledAt());
		assertNull(fresh.getPaidAt());
	}

	@Test
	void toStringNamesTheOrderForLogs() {
		assertTrue(order().toString().contains("PENDING"));
	}

	@Test
	void pendingIsNotATimestampedLanding() {
		Order order = order();
		order.transitionTo(OrderStatus.PAID, Instant.parse("2026-10-07T04:00:00Z"));

		order.transitionTo(OrderStatus.PENDING, Instant.parse("2026-10-07T08:00:00Z"));

		assertEquals(OrderStatus.PENDING, order.getStatus());
		assertEquals(Instant.parse("2026-10-07T04:00:00Z"), order.getPaidAt(),
				"the switch keeps every landing in its own slot and PENDING stamps nothing");
		assertNull(order.getCancelledAt());
	}

	@Test
	void itemToStringNamesTheSnapshotForLogs() {
		OrderItem item = new OrderItem(12L, 1L, "Red Rose", BigDecimal.valueOf(100000), 2,
			BigDecimal.valueOf(200000));

		assertTrue(item.toString().contains("productName='Red Rose'"));
		assertTrue(item.toString().contains("unitPrice=100000"));
		assertTrue(item.toString().contains("lineTotal=200000"));
	}
}
