package com.lavantien.flowershop.api.type;

import com.lavantien.flowershop.api.category.CategoryRepository;
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
@RequestMapping("/api/type")
public class TypeController {
	private final TypeRepository typeRepository;
	private final CategoryRepository categoryRepository;
	private final ProductRepository productRepository;

	public TypeController(TypeRepository typeRepository, CategoryRepository categoryRepository,
		ProductRepository productRepository) {
		this.typeRepository = typeRepository;
		this.categoryRepository = categoryRepository;
		this.productRepository = productRepository;
	}

	@GetMapping
	public ResponseEntity<List<Type>> getAll() {
		return ResponseEntity.ok(typeRepository.findAll());
	}

	@RequireRole(Role.ADMIN)
	@PostMapping
	public ResponseEntity<List<Type>> createMany(@RequestBody List<Type> categories) {
		return ResponseEntity.ok(typeRepository.saveAll(categories));
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping
	public ResponseEntity<?> deleteMany(@RequestBody(required = false) List<Long> ids) {
		// The bulk path must honor the same NAME_IN_USE wall the single delete
		// enforces: any referenced candidate name refuses the whole batch.
		if (ids == null) {
			requireUnreferenced(typeRepository.findAll());
			typeRepository.deleteAll();
			return ResponseEntity.ok().build();
		}
		List<Type> doomed = typeRepository.findAllById(ids);
		requireUnreferenced(doomed);
		typeRepository.deleteAll(doomed);
		return ResponseEntity.ok().build();
	}

	@GetMapping("/{id}")
	public ResponseEntity<Type> getById(@PathVariable Long id) {
		return ResponseEntity.ok(typeRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no type with id " + id)));
	}

	@RequireRole(Role.ADMIN)
	@PostMapping("/create")
	public ResponseEntity<Type> create(@RequestBody Type type) {
		requireFreeName(type.getName(), null);
		requireKnownCategory(type.getCategoryName());
		return ResponseEntity.ok(typeRepository.save(type));
	}

	@RequireRole(Role.ADMIN)
	@Transactional
	@PutMapping("/{id}")
	public ResponseEntity<Type> update(@PathVariable Long id, @RequestBody Type type) {
		// The documented body carries no id, so the addressed row must be
		// mutated and saved: saving the request entity would insert a phantom.
		Type target = typeRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no type with id " + id));
		requireFreeName(type.getName(), id);
		requireKnownCategory(type.getCategoryName());
		String from = target.getName();
		String to = type.getName();
		target.setName(to);
		target.setCategoryName(type.getCategoryName());
		typeRepository.save(target);
		// Products reference the name, not the id, so a rename must carry the
		// reference columns along in the same transaction.
		if (!to.equals(from)) {
			productRepository.renameType(from, to);
		}
		return ResponseEntity.ok(target);
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable Long id) {
		Type type = typeRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no type with id " + id));
		// Products reference the name, not the id: deleting the row would
		// strand every product still pointing at it.
		if (productRepository.existsByTypeName(type.getName())) {
			throw new ConflictException("NAME_IN_USE", "products still reference type " + type.getName());
		}
		typeRepository.deleteById(id);
		return ResponseEntity.noContent().build();
	}

	private void requireFreeName(String name, Long ownedBy) {
		boolean taken = ownedBy == null ? typeRepository.existsByName(name)
			: typeRepository.existsByNameAndIdNot(name, ownedBy);
		if (taken) {
			throw new ConflictException("NAME_IN_USE", "type name " + name + " is already in use");
		}
	}

	// A type belongs to a category: a name matching no row would strand the
	// type exactly like a product pointing at a deleted taxonomy name.
	private void requireKnownCategory(String categoryName) {
		if (categoryName != null && !categoryRepository.existsByName(categoryName)) {
			throw new NotFoundException("no category with name " + categoryName);
		}
	}

	private void requireUnreferenced(List<Type> candidates) {
		for (Type type : candidates) {
			if (productRepository.existsByTypeName(type.getName())) {
				throw new ConflictException("NAME_IN_USE", "products still reference type " + type.getName());
			}
		}
	}
}
