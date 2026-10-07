package com.lavantien.flowershop.api.product;

import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.service.ProductService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/product")
public class ProductController {
	private final ProductRepository productRepository;
	private final ProductService productService;

	public ProductController(ProductRepository productRepository, ProductService productService) {
		this.productRepository = productRepository;
		this.productService = productService;
	}

	@GetMapping
	public ResponseEntity<List<Product>> getAll() {
		return ResponseEntity.ok(productRepository.findAll());
	}

	@RequireRole(Role.ADMIN)
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

	@RequireRole(Role.ADMIN)
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
		return ResponseEntity.ok(productRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no product with id " + id)));
	}

	@RequireRole(Role.ADMIN)
	@PostMapping("/create")
	public ResponseEntity<Product> create(@RequestBody Product product) {
		return ResponseEntity.ok(productRepository.save(product));
	}

	@RequireRole(Role.ADMIN)
	@PutMapping("/{id}")
	public ResponseEntity<Product> update(@PathVariable Long id, @RequestBody Product product) {
		productRepository.findById(id).orElseThrow(() -> new NotFoundException("no product with id " + id));
		return ResponseEntity.ok(productRepository.save(product));
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		productRepository.findById(id).orElseThrow(() -> new NotFoundException("no product with id " + id));
		productRepository.deleteById(id);
		return ResponseEntity.ok().build();
	}
}
