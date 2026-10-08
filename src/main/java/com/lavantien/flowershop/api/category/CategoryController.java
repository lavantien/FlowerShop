package com.lavantien.flowershop.api.category;

import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
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
			requireUnreferenced(categoryRepository.findAll());
			categoryRepository.deleteAll();
			return ResponseEntity.ok().build();
		}
		List<Category> doomed = categoryRepository.findAllById(ids);
		requireUnreferenced(doomed);
		categoryRepository.deleteAll(doomed);
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
	@Transactional
	@PutMapping("/{id}")
	public ResponseEntity<Category> update(@PathVariable Long id, @RequestBody Category category) {
		Category target = categoryRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no category with id " + id));
		requireFreeName(category.getName(), id);
		String from = target.getName();
		String to = category.getName();
		target.setName(to);
		categoryRepository.save(target);
		if (!to.equals(from)) {
			productRepository.renameCategory(from, to);
		}
		return ResponseEntity.ok(target);
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable Long id) {
		Category category = categoryRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no category with id " + id));
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

	private void requireUnreferenced(List<Category> candidates) {
		for (Category category : candidates) {
			if (productRepository.existsByCategoryName(category.getName())) {
				throw new ConflictException("NAME_IN_USE",
					"products still reference category " + category.getName());
			}
		}
	}
}
