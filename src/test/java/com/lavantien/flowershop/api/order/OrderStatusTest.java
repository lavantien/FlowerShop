package com.lavantien.flowershop.api.order;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OrderStatusTest {
	private record Arc(OrderStatus from, OrderStatus to) {}

	// The locked transition table restated independently of the enum, so the
	// matrix test cannot merely mirror the implementation switch.
	private static final Set<Arc> LEGAL = Set.of(
		new Arc(OrderStatus.PENDING, OrderStatus.PAID),
		new Arc(OrderStatus.PENDING, OrderStatus.CANCELLED),
		new Arc(OrderStatus.PAID, OrderStatus.SHIPPED),
		new Arc(OrderStatus.PAID, OrderStatus.CANCELLED),
		new Arc(OrderStatus.SHIPPED, OrderStatus.COMPLETED));

	@Test
	void everyPairFollowsTheLockedArcTable() {
		for (OrderStatus from : OrderStatus.values()) {
			for (OrderStatus to : OrderStatus.values()) {
				assertEquals(LEGAL.contains(new Arc(from, to)), from.canTransitionTo(to), from + " -> " + to);
			}
		}
	}
}
