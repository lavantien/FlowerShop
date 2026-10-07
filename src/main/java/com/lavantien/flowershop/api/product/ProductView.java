package com.lavantien.flowershop.api.product;

import java.math.BigDecimal;

public record ProductView(Long id, String name, String description, String imgUrl, BigDecimal price,
	String typeName, String categoryName, long stock) {

	// stock is the sum over every stock_level row for the product, zero when
	// no branch holds it: the caller owns the lookup, the view owns the shape.
	static ProductView of(Product product, long stock) {
		return new ProductView(product.getId(), product.getName(), product.getDescription(), product.getImgUrl(),
			product.getPrice(), product.getTypeName(), product.getCategoryName(), stock);
	}
}
