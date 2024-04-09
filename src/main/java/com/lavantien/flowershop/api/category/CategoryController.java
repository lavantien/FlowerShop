package com.lavantien.flowershop.api.category;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/category")
public class CategoryController {
	private CategoryRepository categoryRepository;

	public CategoryController(CategoryRepository categoryRepository) {
		this.categoryRepository = categoryRepository;
	}

	@GetMapping
	public ResponseEntity<List<Category>> getAll() {
		return ResponseEntity.ok(categoryRepository.findAll());
	}

	@PostMapping
	public ResponseEntity<List<Category>> createMany(@RequestBody List<Category> categories) {
		return ResponseEntity.ok(categoryRepository.saveAll(categories));
	}

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

	@PostMapping("/create")
	public ResponseEntity<Category> create(@RequestBody Category category) {
		return ResponseEntity.ok(category);
	}

	@PutMapping("/{id}")
	public ResponseEntity<Category> update(@PathVariable Long id, @RequestBody Category category) {
		if (categoryRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(categoryRepository.save(category));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		if (categoryRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		categoryRepository.deleteById(id);
		return ResponseEntity.ok().build();
	}
}
