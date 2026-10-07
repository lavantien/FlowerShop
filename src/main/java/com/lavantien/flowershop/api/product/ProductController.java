package com.lavantien.flowershop.api.product;

import com.lavantien.flowershop.api.PageDto;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.service.ProductService;
import jakarta.persistence.criteria.Predicate;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/product")
public class ProductController {
	// The parsed and clamped catalog query: the only place page, size, and
	// sort policy live, so both the controller and its tests read one rule.
	record CatalogQuery(String search, String category, String type, Sort sort, int page, int size) {
		static CatalogQuery of(String search, String category, String type, String sort, Integer page, Integer size) {
			return new CatalogQuery(blankToNull(search), blankToNull(category), blankToNull(type), sortOf(sort),
				page == null ? 0 : Math.max(page, 0),
				size == null ? 12 : Math.min(Math.max(size, 1), 48));
		}

		private static String blankToNull(String value) {
			return value == null || value.isBlank() ? null : value.strip();
		}

		// The sort whitelist: anything unknown falls back to name-asc, the
		// same silent-clamp philosophy the paging parameters follow.
		private static Sort sortOf(String raw) {
			return switch (raw == null ? "" : raw.strip()) {
				case "name-desc" -> Sort.by(Sort.Direction.DESC, "name");
				case "price-asc" -> Sort.by(Sort.Direction.ASC, "price");
				case "price-desc" -> Sort.by(Sort.Direction.DESC, "price");
				default -> Sort.by(Sort.Direction.ASC, "name");
			};
		}
	}

	private final ProductRepository productRepository;
	private final ProductService productService;

	public ProductController(ProductRepository productRepository, ProductService productService) {
		this.productRepository = productRepository;
		this.productService = productService;
	}

	@GetMapping
	public PageDto<ProductView> getAll(@RequestParam(required = false) String search,
		@RequestParam(required = false) String category, @RequestParam(required = false) String type,
		@RequestParam(required = false) String sort, @RequestParam(required = false) Integer page,
		@RequestParam(required = false) Integer size) {
		CatalogQuery query = CatalogQuery.of(search, category, type, sort, page, size);
		Page<Product> products = productRepository.findAll(catalogSpecification(query),
			PageRequest.of(query.page(), query.size(), query.sort()));
		return PageDto.from(products, ProductView::from);
	}

	@GetMapping("/{id}")
	public ProductView getById(@PathVariable Long id) {
		return ProductView.from(productRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no product with id " + id)));
	}

	@RequireRole(Role.ADMIN)
	@PostMapping
	public List<ProductView> createMany(@RequestBody List<@Valid ProductInput> inputs) {
		List<Product> products = inputs.stream().map(ProductInput::toEntity).toList();
		List<Product> saved;
		try {
			saved = productService.upsertAll(products);
		} catch (DataIntegrityViolationException raced) {
			// A concurrent request inserted the same id first and poisoned this
			// transaction: retry the whole payload in a fresh one, as updates.
			saved = productService.upsertAll(products);
		}
		return saved.stream().map(ProductView::from).toList();
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping
	public ResponseEntity<?> deleteMany(@RequestBody(required = false) List<Long> ids) {
		if (ids == null) {
			productRepository.deleteAll();
		} else {
			productRepository.deleteAll(productRepository.findAllById(ids));
		}
		return ResponseEntity.noContent().build();
	}

	@RequireRole(Role.ADMIN)
	@PostMapping("/create")
	public ProductView create(@Valid @RequestBody ProductInput input) {
		return ProductView.from(productRepository.save(input.toEntity()));
	}

	@RequireRole(Role.ADMIN)
	@PutMapping("/{id}")
	public ProductView update(@PathVariable Long id, @Valid @RequestBody ProductInput input) {
		productRepository.findById(id).orElseThrow(() -> new NotFoundException("no product with id " + id));
		Product replacement = input.toEntity();
		replacement.setId(id);
		return ProductView.from(productRepository.save(replacement));
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		productRepository.findById(id).orElseThrow(() -> new NotFoundException("no product with id " + id));
		productRepository.deleteById(id);
		return ResponseEntity.noContent().build();
	}

	static Specification<Product> catalogSpecification(CatalogQuery query) {
		return (root, _, builder) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (query.search() != null) {
				predicates.add(builder.like(builder.lower(root.<String>get("name")),
					"%" + query.search().toLowerCase(Locale.ROOT) + "%"));
			}
			if (query.category() != null) {
				predicates.add(builder.equal(root.<String>get("categoryName"), query.category()));
			}
			if (query.type() != null) {
				predicates.add(builder.equal(root.<String>get("typeName"), query.type()));
			}
			return builder.and(predicates.toArray(new Predicate[0]));
		};
	}
}
