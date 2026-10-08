package com.lavantien.flowershop.api.product;

import java.math.BigDecimal;

public record ProductView(Long id, String name, String description, String imgUrl, BigDecimal price,
	String typeName, String categoryName, long stock) {

	public static ProductView of(Product product, long stock) {
		return new ProductView(product.getId(), product.getName(), product.getDescription(), product.getImgUrl(),
			product.getPrice(), product.getTypeName(), product.getCategoryName(), stock);
	}
}
