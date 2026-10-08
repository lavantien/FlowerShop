package com.lavantien.flowershop.api.wishlist;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(name = "wishlist_item", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "product_id"}))
public class WishlistItem {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	@Column(name = "user_id", nullable = false)
	private Long userId;
	@Column(name = "product_id", nullable = false)
	private Long productId;
	private Instant createdAt;

	public WishlistItem() {
	}

	public WishlistItem(Long userId, Long productId) {
		this.userId = userId;
		this.productId = productId;
		this.createdAt = Instant.now();
	}

	@Override
	public String toString() {
		return "WishlistItem{" +
			"id=" + id +
			", userId=" + userId +
			", productId=" + productId +
			", createdAt=" + createdAt +
			'}';
	}


	public Long getUserId() {
		return userId;
	}

	public Long getProductId() {
		return productId;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Instant createdAt) {
		this.createdAt = createdAt;
	}
}
