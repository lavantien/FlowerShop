package com.lavantien.flowershop.api.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "orders")
public class Order {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	private Long userId;
	@Enumerated(EnumType.STRING)
	private OrderStatus status = OrderStatus.PENDING;
	private Instant placedAt;
	private Instant paidAt;
	private Instant shippedAt;
	private Instant completedAt;
	private Instant cancelledAt;
	private String phone;
	private String address;
	private String district;
	private String city;
	private Long branchId;
	private Double distanceKm;
	@Column(precision = 12, scale = 0)
	private BigDecimal deliveryFee;
	private String couponCode;
	@Column(precision = 12, scale = 0)
	private BigDecimal discountAmount = BigDecimal.ZERO;
	@Column(precision = 12, scale = 0)
	private BigDecimal subtotal;
	@Column(precision = 12, scale = 0)
	private BigDecimal total;

	public Order() {
	}

	public Order(Long userId, String phone, String address, String district, String city, Long branchId,
		Double distanceKm, BigDecimal deliveryFee, String couponCode, BigDecimal discountAmount,
		BigDecimal subtotal, BigDecimal total) {
		this.userId = userId;
		this.phone = phone;
		this.address = address;
		this.district = district;
		this.city = city;
		this.branchId = branchId;
		this.distanceKm = distanceKm;
		this.deliveryFee = deliveryFee;
		this.couponCode = couponCode;
		this.discountAmount = discountAmount;
		this.subtotal = subtotal;
		this.total = total;
	}

	@Override
	public String toString() {
		return "Order{" +
			"id=" + id +
			", userId=" + userId +
			", status=" + status +
			", placedAt=" + placedAt +
			", phone='" + phone + '\'' +
			", city='" + city + '\'' +
			", branchId=" + branchId +
			", distanceKm=" + distanceKm +
			", deliveryFee=" + deliveryFee +
			", couponCode='" + couponCode + '\'' +
			", discountAmount=" + discountAmount +
			", subtotal=" + subtotal +
			", total=" + total +
			'}';
	}

	public void transitionTo(OrderStatus next, Instant at) {
		this.status = next;
		switch (next) {
			case PENDING -> {
			}
			case PAID -> paidAt = at;
			case SHIPPED -> shippedAt = at;
			case COMPLETED -> completedAt = at;
			case CANCELLED -> cancelledAt = at;
		}
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public Long getUserId() {
		return userId;
	}

	public OrderStatus getStatus() {
		return status;
	}

	public void setStatus(OrderStatus status) {
		this.status = status;
	}

	public Instant getPlacedAt() {
		return placedAt;
	}

	public void setPlacedAt(Instant placedAt) {
		this.placedAt = placedAt;
	}

	public Instant getPaidAt() {
		return paidAt;
	}

	public Instant getShippedAt() {
		return shippedAt;
	}

	public Instant getCompletedAt() {
		return completedAt;
	}

	public Instant getCancelledAt() {
		return cancelledAt;
	}

	public String getPhone() {
		return phone;
	}

	public String getAddress() {
		return address;
	}

	public String getDistrict() {
		return district;
	}

	public String getCity() {
		return city;
	}

	public Long getBranchId() {
		return branchId;
	}

	public Double getDistanceKm() {
		return distanceKm;
	}

	public BigDecimal getDeliveryFee() {
		return deliveryFee;
	}

	public String getCouponCode() {
		return couponCode;
	}

	public BigDecimal getDiscountAmount() {
		return discountAmount;
	}

	public BigDecimal getSubtotal() {
		return subtotal;
	}

	public BigDecimal getTotal() {
		return total;
	}
}
