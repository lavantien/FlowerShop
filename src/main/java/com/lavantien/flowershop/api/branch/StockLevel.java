package com.lavantien.flowershop.api.branch;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "stock_level", uniqueConstraints = @UniqueConstraint(columnNames = {"branch_id", "product_id"}))
public class StockLevel {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	private Long branchId;
	private Long productId;
	private int quantity;

	public StockLevel() {
	}

	public StockLevel(Long branchId, Long productId, int quantity) {
		this.branchId = branchId;
		this.productId = productId;
		this.quantity = quantity;
	}

	@Override
	public String toString() {
		return "StockLevel{" +
			"id=" + id +
			", branchId=" + branchId +
			", productId=" + productId +
			", quantity=" + quantity +
			'}';
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public Long getBranchId() {
		return branchId;
	}

	public void setBranchId(Long branchId) {
		this.branchId = branchId;
	}

	public Long getProductId() {
		return productId;
	}

	public void setProductId(Long productId) {
		this.productId = productId;
	}

	public int getQuantity() {
		return quantity;
	}

	public void setQuantity(int quantity) {
		this.quantity = quantity;
	}
}
