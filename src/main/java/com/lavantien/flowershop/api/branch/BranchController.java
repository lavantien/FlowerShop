package com.lavantien.flowershop.api.branch;

import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/branch")
public class BranchController {
	// The Size ceilings mirror the 255-wide columns so a wide string fails
	// validation instead of blowing up at the database.
	public record BranchInput(@NotBlank @Size(max = 255) String name, @Size(max = 255) String address,
		@Size(max = 255) String district, @Size(max = 255) String city,
		Double lat, Double lng, Boolean active) {

		Branch toBranch() {
			Branch branch = new Branch();
			applyTo(branch);
			return branch;
		}

		void applyTo(Branch branch) {
			branch.setName(name);
			branch.setAddress(address);
			branch.setDistrict(district);
			branch.setCity(city);
			branch.setLat(lat);
			branch.setLng(lng);
			// An omitted active keeps the stored flag on updates and rides the
			// entity's true default on creates.
			if (active != null) {
				branch.setActive(active);
			}
		}
	}

	public record StockSetRequest(@NotNull Long productId, @NotNull Integer quantity) {}

	private final BranchRepository branchRepository;
	private final StockLevelRepository stockLevelRepository;
	private final ProductRepository productRepository;

	public BranchController(BranchRepository branchRepository, StockLevelRepository stockLevelRepository,
		ProductRepository productRepository) {
		this.branchRepository = branchRepository;
		this.stockLevelRepository = stockLevelRepository;
		this.productRepository = productRepository;
	}

	@GetMapping
	public List<Branch> getAll() {
		return branchRepository.findAll();
	}

	@RequireRole(Role.ADMIN)
	@PostMapping
	public Branch create(@Valid @RequestBody BranchInput input) {
		return branchRepository.save(input.toBranch());
	}

	@RequireRole(Role.ADMIN)
	@PutMapping("/{id}")
	public Branch update(@PathVariable Long id, @Valid @RequestBody BranchInput input) {
		Branch managed = branchRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no branch with id " + id));
		input.applyTo(managed);
		return branchRepository.save(managed);
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable Long id) {
		branchRepository.findById(id).orElseThrow(() -> new NotFoundException("no branch with id " + id));
		if (stockLevelRepository.existsByBranchId(id)) {
			throw new ConflictException("STOCK_ROWS_EXIST", "branch " + id + " still holds stock rows");
		}
		branchRepository.deleteById(id);
		return ResponseEntity.noContent().build();
	}

	@RequireRole(Role.ADMIN)
	@GetMapping("/{id}/stock")
	public List<StockView> getStock(@PathVariable Long id) {
		requireBranch(id);
		Map<Long, Integer> quantities = new HashMap<>();
		for (StockLevel row : stockLevelRepository.findByBranchId(id)) {
			quantities.put(row.getProductId(), row.getQuantity());
		}
		return productRepository.findAll().stream()
			.map(product -> new StockView(product.getId(), quantities.getOrDefault(product.getId(), 0)))
			.sorted(Comparator.comparing(StockView::productId))
			.toList();
	}

	@RequireRole(Role.ADMIN)
	@PutMapping("/{id}/stock")
	public StockView setStock(@PathVariable Long id, @Valid @RequestBody StockSetRequest request) {
		requireBranch(id);
		productRepository.findById(request.productId())
			.orElseThrow(() -> new NotFoundException("no product with id " + request.productId()));
		// The set is absolute and never negative: floor at zero.
		int quantity = Math.max(request.quantity(), 0);
		StockLevel row = stockLevelRepository.findByBranchIdAndProductId(id, request.productId())
			.orElseGet(() -> new StockLevel(id, request.productId(), 0));
		row.setQuantity(quantity);
		stockLevelRepository.save(row);
		return new StockView(request.productId(), quantity);
	}

	private void requireBranch(Long id) {
		branchRepository.findById(id).orElseThrow(() -> new NotFoundException("no branch with id " + id));
	}
}
