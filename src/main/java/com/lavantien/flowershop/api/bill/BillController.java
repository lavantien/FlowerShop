package com.lavantien.flowershop.api.bill;

import com.lavantien.flowershop.api.security.Auth;
import com.lavantien.flowershop.api.security.RequireRole;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/bill")
public class BillController {
	private BillRepository billRepository;

	public BillController(BillRepository billRepository) {
		this.billRepository = billRepository;
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@GetMapping
	public ResponseEntity<List<Bill>> getAll() {
		return ResponseEntity.ok(billRepository.findAll());
	}

	@PostMapping
	public ResponseEntity<List<Bill>> createMany(@RequestBody List<Bill> bills, HttpServletRequest request) {
		for (Bill bill : bills) {
			bill.setUserId(Auth.userId(request));
		}
		return ResponseEntity.ok(billRepository.saveAll(bills));
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@DeleteMapping
	public ResponseEntity<?> deleteMany(@RequestBody(required = false) List<Long> ids) {
		if (ids == null) {
			billRepository.deleteAll();
			return ResponseEntity.ok().build();
		}
		billRepository.deleteAll(billRepository.findAllById(ids));
		return ResponseEntity.ok().build();
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@GetMapping("/{id}")
	public ResponseEntity<Bill> getById(@PathVariable Long id) {
		Optional<Bill> bill = billRepository.findById(id);
		if (bill.isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(bill.get());
	}

	@PostMapping("/create")
	public ResponseEntity<Bill> create(@RequestBody Bill bill) {
		return ResponseEntity.ok(bill);
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@PutMapping("/{id}")
	public ResponseEntity<Bill> update(@PathVariable Long id, @RequestBody Bill bill) {
		if (billRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(billRepository.save(bill));
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		if (billRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		billRepository.deleteById(id);
		return ResponseEntity.ok().build();
	}

	@GetMapping("/user/{id}")
	public ResponseEntity<List<Bill>> getByUserId(@PathVariable Long id, HttpServletRequest request) {
		if (!Auth.ownIdOrAdmin(id, request)) {
			return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
		}
		return ResponseEntity.ok(billRepository.findByUserId(id));
	}
}
