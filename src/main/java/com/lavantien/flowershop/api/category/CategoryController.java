package com.lavantien.flowershop.api.category;

import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/category")
public class CategoryController {
	private final CategoryRepository categoryRepository;
	private final ProductRepository productRepository;

	public CategoryController(CategoryRepository categoryRepository, ProductRepository productRepository) {
		this.categoryRepository = categoryRepository;
		this.productRepository = productRepository;
	}

	@GetMapping
	public ResponseEntity<List<Category>> getAll() {
		return ResponseEntity.ok(categoryRepository.findAll());
	}

	@RequireRole(Role.ADMIN)
	@PostMapping
	public ResponseEntity<List<Category>> createMany(@RequestBody List<Category> categories) {
		return ResponseEntity.ok(categoryRepository.saveAll(categories));
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping
	public ResponseEntity<?> deleteMany(@RequestBody(required = false) List<Long> ids) {
		if (ids == null) {
			categoryRepository.deleteAll();
			return ResponseEntity.ok().build();
		}
		categoryRepository.deleteAll(categoryRepository.findAllById(ids));
		return ResponseEntity.ok().build();
	}

	@GetMapping("/{id}")
	public ResponseEntity<Category> getById(@PathVariable Long id) {
		return ResponseEntity.ok(categoryRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no category with id " + id)));
	}

	@RequireRole(Role.ADMIN)
	@PostMapping("/create")
	public ResponseEntity<Category> create(@RequestBody Category category) {
		requireFreeName(category.getName(), null);
		return ResponseEntity.ok(categoryRepository.save(category));
	}

	@RequireRole(Role.ADMIN)
	@PutMapping("/{id}")
	public ResponseEntity<Category> update(@PathVariable Long id, @RequestBody Category category) {
		categoryRepository.findById(id).orElseThrow(() -> new NotFoundException("no category with id " + id));
		requireFreeName(category.getName(), id);
		return ResponseEntity.ok(categoryRepository.save(category));
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable Long id) {
		Category category = categoryRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no category with id " + id));
		// Products reference the name, not the id: deleting the row would
		// strand every product still pointing at it.
		if (productRepository.existsByCategoryName(category.getName())) {
			throw new ConflictException("NAME_IN_USE", "products still reference category " + category.getName());
		}
		categoryRepository.deleteById(id);
		return ResponseEntity.noContent().build();
	}

	private void requireFreeName(String name, Long ownedBy) {
		boolean taken = ownedBy == null ? categoryRepository.existsByName(name)
			: categoryRepository.existsByNameAndIdNot(name, ownedBy);
		if (taken) {
			throw new ConflictException("NAME_IN_USE", "category name " + name + " is already in use");
		}
	}
}
