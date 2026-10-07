package com.lavantien.flowershop.api.product;

import java.math.BigDecimal;

public record ProductView(Long id, String name, String description, String imgUrl, BigDecimal price,
	String typeName, String categoryName, long stock) {

	// stock_level does not exist yet: the product row's own quantity stands
	// in until the branch stock sum rewires this source.
	static ProductView from(Product product) {
		return new ProductView(product.getId(), product.getName(), product.getDescription(), product.getImgUrl(),
			product.getPrice(), product.getTypeName(), product.getCategoryName(),
			product.getQuantity() == null ? 0L : product.getQuantity());
	}
}
