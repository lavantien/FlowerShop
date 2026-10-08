package com.lavantien.flowershop.api.product;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.hibernate.validator.constraints.Length;

import java.math.BigDecimal;
import java.math.RoundingMode;

public record ProductInput(Long id, @NotBlank String name, @Length(max = 2000) String description,
	@Length(max = 2000) String imgUrl, @NotNull @Positive BigDecimal price, String typeName,
	String categoryName) {

	Product toEntity() {
		Product product = new Product();
		product.setId(id);
		product.setName(name);
		product.setDescription(description);
		product.setImgUrl(imgUrl);
		product.setPrice(price.setScale(0, RoundingMode.HALF_UP));
		product.setTypeName(typeName);
		product.setCategoryName(categoryName);
		return product;
	}
}
