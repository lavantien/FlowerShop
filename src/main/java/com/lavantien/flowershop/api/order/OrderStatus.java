package com.lavantien.flowershop.api.order;

public enum OrderStatus {
	PENDING, PAID, SHIPPED, COMPLETED, CANCELLED;

	// The one place the legal arcs are defined. Every mutation path funnels
	// through this table; the terminals refuse everything.
	public boolean canTransitionTo(OrderStatus next) {
		return switch (this) {
			case PENDING -> next == PAID || next == CANCELLED;
			case PAID -> next == SHIPPED || next == CANCELLED;
			case SHIPPED -> next == COMPLETED;
			case COMPLETED, CANCELLED -> false;
		};
	}
}
