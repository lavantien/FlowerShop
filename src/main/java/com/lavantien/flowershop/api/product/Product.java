package com.lavantien.flowershop.api.product;

import org.hibernate.validator.constraints.Length;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.math.BigDecimal;

@Entity
public class Product {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	private String name;
	@Length(max = 2000)
	private String description;
	@Length(max = 2000)
	private String imgUrl;
	@Column(precision = 12, scale = 0)
	private BigDecimal price;
	private Long quantity;
	private Long saleAmount = 0L;
	private String typeName;
	private String categoryName;

	public Product() {
	}

	public Product(String name, String description, String imgUrl, BigDecimal price, Long quantity, Long saleAmount, String typeName, String categoryName) {
		this.name = name;
		this.description = description;
		this.imgUrl = imgUrl;
		this.price = price;
		this.quantity = quantity;
		this.saleAmount = saleAmount;
		this.typeName = typeName;
		this.categoryName = categoryName;
	}

	@Override
	public String toString() {
		return "Product{" +
			"id=" + id +
			", name='" + name + '\'' +
			", description='" + description + '\'' +
			", imgUrl='" + imgUrl + '\'' +
			", price=" + price +
			", quantity=" + quantity +
			", saleAmount=" + saleAmount +
			", typeName='" + typeName + '\'' +
			", categoryName='" + categoryName + '\'' +
			'}';
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getImgUrl() {
		return imgUrl;
	}

	public void setImgUrl(String imgUrl) {
		this.imgUrl = imgUrl;
	}

	public BigDecimal getPrice() {
		return price;
	}

	public void setPrice(BigDecimal price) {
		this.price = price;
	}

	// quantity and saleAmount keep getters only: the input DTO never writes
	// them and the stock_level sum plus the legacy-field sweep replace both.
	public Long getQuantity() {
		return quantity;
	}

	public Long getSaleAmount() {
		return saleAmount;
	}

	public String getTypeName() {
		return typeName;
	}

	public void setTypeName(String typeName) {
		this.typeName = typeName;
	}

	public String getCategoryName() {
		return categoryName;
	}

	public void setCategoryName(String categoryName) {
		this.categoryName = categoryName;
	}
}
