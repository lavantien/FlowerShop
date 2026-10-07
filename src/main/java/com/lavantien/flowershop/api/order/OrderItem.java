package com.lavantien.flowershop.api.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.math.BigDecimal;

@Entity
public class OrderItem {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	private Long orderId;
	private Long productId;
	private String productName;
	@Column(precision = 12, scale = 0)
	private BigDecimal unitPrice;
	private int quantity;
	@Column(precision = 12, scale = 0)
	private BigDecimal lineTotal;

	public OrderItem() {
	}

	public OrderItem(Long orderId, Long productId, String productName, BigDecimal unitPrice, int quantity,
		BigDecimal lineTotal) {
		this.orderId = orderId;
		this.productId = productId;
		this.productName = productName;
		this.unitPrice = unitPrice;
		this.quantity = quantity;
		this.lineTotal = lineTotal;
	}

	@Override
	public String toString() {
		return "OrderItem{" +
			"id=" + id +
			", orderId=" + orderId +
			", productId=" + productId +
			", productName='" + productName + '\'' +
			", unitPrice=" + unitPrice +
			", quantity=" + quantity +
			", lineTotal=" + lineTotal +
			'}';
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public Long getOrderId() {
		return orderId;
	}

	public void setOrderId(Long orderId) {
		this.orderId = orderId;
	}

	public Long getProductId() {
		return productId;
	}

	public String getProductName() {
		return productName;
	}

	public BigDecimal getUnitPrice() {
		return unitPrice;
	}

	public int getQuantity() {
		return quantity;
	}

	public BigDecimal getLineTotal() {
		return lineTotal;
	}
}
