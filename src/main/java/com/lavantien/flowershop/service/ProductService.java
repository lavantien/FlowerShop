package com.lavantien.flowershop.service;

import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class ProductService {
	private ProductRepository productRepository;

	public ProductService(ProductRepository productRepository) {
		this.productRepository = productRepository;
	}

	// Hibernate 7 merge no longer inserts a detached entity whose row is absent,
	// so explicit ids need a native insert when the row is missing. A duplicate-key
	// failure poisons this transaction, so callers must retry in a fresh one.
	@Transactional
	public List<Product> upsertAll(List<Product> products) {
		List<Product> saved = new ArrayList<>(products.size());
		for (Product product : products) {
			if (product.getId() == null || productRepository.existsById(product.getId())) {
				saved.add(productRepository.save(product));
			} else {
				productRepository.insertWithId(product);
				saved.add(productRepository.findById(product.getId()).orElse(product));
			}
		}
		return saved;
	}
}
