package com.lavantien.flowershop.api.product;

import com.lavantien.flowershop.service.ProductService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/product")
public class ProductController {
	private ProductRepository productRepository;
	private ProductService productService;

	public ProductController(ProductRepository productRepository, ProductService productService) {
		this.productRepository = productRepository;
		this.productService = productService;
	}

	@GetMapping
	public ResponseEntity<List<Product>> getAll() {
		return ResponseEntity.ok(productRepository.findAll());
	}

	@PostMapping
	public ResponseEntity<List<Product>> createMany(@RequestBody List<Product> products) {
		try {
			return ResponseEntity.ok(productService.upsertAll(products));
		} catch (DataIntegrityViolationException raced) {
			// A concurrent request inserted the same id first and poisoned this
			// transaction: retry the whole payload in a fresh one, as updates.
			return ResponseEntity.ok(productService.upsertAll(products));
		}
	}

	@DeleteMapping
	public ResponseEntity<?> deleteMany(@RequestBody(required = false) List<Long> ids) {
		if (ids == null) {
			productRepository.deleteAll();
			return ResponseEntity.ok().build();
		}
		productRepository.deleteAll(productRepository.findAllById(ids));
		return ResponseEntity.ok().build();
	}

	@GetMapping("/{id}")
	public ResponseEntity<Product> getById(@PathVariable Long id) {
		Optional<Product> product = productRepository.findById(id);
		if (product.isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(product.get());
	}

	@PostMapping("/create")
	public ResponseEntity<Product> create(@RequestBody Product product) {
		return ResponseEntity.ok(product);
	}

	@PutMapping("/{id}")
	public ResponseEntity<Product> update(@PathVariable Long id, @RequestBody Product product) {
		if (productRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(productRepository.save(product));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		if (productRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		productRepository.deleteById(id);
		return ResponseEntity.ok().build();
	}
}
