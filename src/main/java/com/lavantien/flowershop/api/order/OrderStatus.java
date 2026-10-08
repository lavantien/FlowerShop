package com.lavantien.flowershop.api.order;

public enum OrderStatus {
	PENDING, PAID, SHIPPED, COMPLETED, CANCELLED;

	public boolean canTransitionTo(OrderStatus next) {
		return switch (this) {
			case PENDING -> next == PAID || next == CANCELLED;
			case PAID -> next == SHIPPED || next == CANCELLED;
			case SHIPPED -> next == COMPLETED;
			case COMPLETED, CANCELLED -> false;
		};
	}
}
