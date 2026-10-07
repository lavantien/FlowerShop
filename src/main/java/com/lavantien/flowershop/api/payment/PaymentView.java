package com.lavantien.flowershop.api.payment;

import java.math.BigDecimal;

public record PaymentView(String paymentId, Long orderId, BigDecimal amount, PaymentStatus status, String summary) {

	public static PaymentView of(PaymentSession session) {
		return new PaymentView(session.getId(), session.getOrderId(), session.getAmount(), session.getStatus(),
			"payment of " + session.getAmount().toPlainString() + " VND for order " + session.getOrderId());
	}
}
