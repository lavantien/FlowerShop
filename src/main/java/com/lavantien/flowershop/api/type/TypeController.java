package com.lavantien.flowershop.api.type;

import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/type")
public class TypeController {
	private final TypeRepository typeRepository;
	private final ProductRepository productRepository;

	public TypeController(TypeRepository typeRepository, ProductRepository productRepository) {
		this.typeRepository = typeRepository;
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
		if (ids == null) {
			typeRepository.deleteAll();
			return ResponseEntity.ok().build();
		}
		typeRepository.deleteAll(typeRepository.findAllById(ids));
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
		return ResponseEntity.ok(typeRepository.save(type));
	}

	@RequireRole(Role.ADMIN)
	@PutMapping("/{id}")
	public ResponseEntity<Type> update(@PathVariable Long id, @RequestBody Type type) {
		typeRepository.findById(id).orElseThrow(() -> new NotFoundException("no type with id " + id));
		requireFreeName(type.getName(), id);
		return ResponseEntity.ok(typeRepository.save(type));
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
}
