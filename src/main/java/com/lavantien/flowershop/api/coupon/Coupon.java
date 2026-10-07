package com.lavantien.flowershop.api.coupon;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

@Entity
public class Coupon {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	@Column(nullable = false, unique = true)
	private String code;
	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private CouponKind kind;
	@Column(nullable = false, precision = 12, scale = 0)
	private BigDecimal value;
	@Column(nullable = false)
	private boolean active = true;
	private Instant expiresAt;

	public Coupon() {
	}

	public Coupon(String code, CouponKind kind, BigDecimal value, boolean active, Instant expiresAt) {
		this.code = code;
		this.kind = kind;
		this.value = value;
		this.active = active;
		this.expiresAt = expiresAt;
	}

	@Override
	public String toString() {
		return "Coupon{" +
			"id=" + id +
			", code='" + code + '\'' +
			", kind=" + kind +
			", value=" + value +
			", active=" + active +
			", expiresAt=" + expiresAt +
			'}';
	}

	// The raw formula the validate endpoint returns verbatim; the checkout
	// rounds it to the money step like every other computed amount.
	public BigDecimal discountOn(BigDecimal subtotal) {
		BigDecimal raw = kind == CouponKind.PERCENT
			? subtotal.multiply(value).divide(BigDecimal.valueOf(100), 0, RoundingMode.CEILING)
			: value;
		return raw.min(subtotal);
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public CouponKind getKind() {
		return kind;
	}

	public void setKind(CouponKind kind) {
		this.kind = kind;
	}

	public BigDecimal getValue() {
		return value;
	}

	public void setValue(BigDecimal value) {
		this.value = value;
	}

	public boolean isActive() {
		return active;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public void setExpiresAt(Instant expiresAt) {
		this.expiresAt = expiresAt;
	}
}
