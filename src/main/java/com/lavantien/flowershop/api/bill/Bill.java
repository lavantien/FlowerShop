package com.lavantien.flowershop.api.bill;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class Bill {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	private String placementDate;
	private Long productId;
	private Long productQuantity;
	private Double price;
	private String settlementDate;
	private String status;
	private Long userId;
	private String phone;
	private String detailAddress;

	public Bill() {
	}

	public Bill(String placementDate, Long productId, Long productQuantity, Double price, Long userId, String settlementDate, String status, String phone, String detailAddress) {
		this.placementDate = placementDate;
		this.productId = productId;
		this.productQuantity = productQuantity;
		this.price = price;
		this.userId = userId;
		this.settlementDate = settlementDate;
		this.status = status;
		this.phone = phone;
		this.detailAddress = detailAddress;
	}

	@Override
	public String toString() {
		return "Bill{" +
			"id=" + id +
			", placementDate='" + placementDate + '\'' +
			", productId=" + productId +
			", productQuantity=" + productQuantity +
			", price=" + price +
			", settlementDate='" + settlementDate + '\'' +
			", status='" + status + '\'' +
			", userId=" + userId +
			", phone='" + phone + '\'' +
			", detailAddress='" + detailAddress + '\'' +
			'}';
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getPlacementDate() {
		return placementDate;
	}

	public void setPlacementDate(String placementDate) {
		this.placementDate = placementDate;
	}

	public Long getProductId() {
		return productId;
	}

	public void setProductId(Long productId) {
		this.productId = productId;
	}

	public Long getProductQuantity() {
		return productQuantity;
	}

	public void setProductQuantity(Long productQuantity) {
		this.productQuantity = productQuantity;
	}

	public Double getPrice() {
		return price;
	}

	public void setPrice(Double price) {
		this.price = price;
	}

	public Long getUserId() {
		return userId;
	}

	public void setUserId(Long userId) {
		this.userId = userId;
	}

	public String getSettlementDate() {
		return settlementDate;
	}

	public void setSettlementDate(String settlementDate) {
		this.settlementDate = settlementDate;
	}

	public String getStatus() {
		return status;
	}

	public void setStatus(String status) {
		this.status = status;
	}

	public String getPhone() {
		return phone;
	}

	public void setPhone(String phone) {
		this.phone = phone;
	}

	public String getDetailAddress() {
		return detailAddress;
	}

	public void setDetailAddress(String detailAddress) {
		this.detailAddress = detailAddress;
	}
}
