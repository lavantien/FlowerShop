package com.lavantien.flowershop.api.category;

import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/category")
public class CategoryController {
	private final CategoryRepository categoryRepository;

	public CategoryController(CategoryRepository categoryRepository) {
		this.categoryRepository = categoryRepository;
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
		Optional<Category> category = categoryRepository.findById(id);
		if (category.isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(category.get());
	}

	@RequireRole(Role.ADMIN)
	@PostMapping("/create")
	public ResponseEntity<Category> create(@RequestBody Category category) {
		return ResponseEntity.ok(categoryRepository.save(category));
	}

	@RequireRole(Role.ADMIN)
	@PutMapping("/{id}")
	public ResponseEntity<Category> update(@PathVariable Long id, @RequestBody Category category) {
		if (categoryRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(categoryRepository.save(category));
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		if (categoryRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		categoryRepository.deleteById(id);
		return ResponseEntity.ok().build();
	}
}
