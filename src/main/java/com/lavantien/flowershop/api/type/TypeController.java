package com.lavantien.flowershop.api.type;

import com.lavantien.flowershop.api.security.Auth;
import com.lavantien.flowershop.api.security.RequireRole;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/type")
public class TypeController {
	private TypeRepository typeRepository;

	public TypeController(TypeRepository typeRepository) {
		this.typeRepository = typeRepository;
	}

	@GetMapping
	public ResponseEntity<List<Type>> getAll() {
		return ResponseEntity.ok(typeRepository.findAll());
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@PostMapping
	public ResponseEntity<List<Type>> createMany(@RequestBody List<Type> categories) {
		return ResponseEntity.ok(typeRepository.saveAll(categories));
	}

	@RequireRole(Auth.ADMIN_TYPE)
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
		Optional<Type> type = typeRepository.findById(id);
		if (type.isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(type.get());
	}

	@PostMapping("/create")
	public ResponseEntity<Type> create(@RequestBody Type type) {
		return ResponseEntity.ok(type);
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@PutMapping("/{id}")
	public ResponseEntity<Type> update(@PathVariable Long id, @RequestBody Type type) {
		if (typeRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(typeRepository.save(type));
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		if (typeRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		typeRepository.deleteById(id);
		return ResponseEntity.ok().build();
	}
}
