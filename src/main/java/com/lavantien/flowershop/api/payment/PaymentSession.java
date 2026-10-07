package com.lavantien.flowershop.api.payment;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
public class PaymentSession {
	@Id
	private String id;
	// One live session per order: the unique key is the replay wall beside
	// the status guard and the order transition guard.
	@Column(unique = true)
	private Long orderId;
	@Column(precision = 12, scale = 0)
	private BigDecimal amount;
	@Enumerated(EnumType.STRING)
	private PaymentStatus status = PaymentStatus.PENDING;
	private Instant createdAt;
	private Instant confirmedAt;

	public PaymentSession() {
	}

	public PaymentSession(String id, Long orderId, BigDecimal amount) {
		this.id = id;
		this.orderId = orderId;
		this.amount = amount;
	}

	@Override
	public String toString() {
		return "PaymentSession{" +
			"id='" + id + '\'' +
			", orderId=" + orderId +
			", amount=" + amount +
			", status=" + status +
			", createdAt=" + createdAt +
			", confirmedAt=" + confirmedAt +
			'}';
	}

	public void start(Instant at) {
		this.createdAt = at;
	}

	public void confirm(Instant at) {
		this.status = PaymentStatus.CONFIRMED;
		this.confirmedAt = at;
	}

	public void cancel(Instant at) {
		this.status = PaymentStatus.CANCELLED;
	}

	public String getId() {
		return id;
	}

	public Long getOrderId() {
		return orderId;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public PaymentStatus getStatus() {
		return status;
	}

	public Instant getConfirmedAt() {
		return confirmedAt;
	}
}
