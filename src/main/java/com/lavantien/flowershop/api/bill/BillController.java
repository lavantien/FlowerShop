package com.lavantien.flowershop.api.bill;

import com.lavantien.flowershop.api.error.ForbiddenException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.security.Auth;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bill")
public class BillController {
	private final BillRepository billRepository;

	public BillController(BillRepository billRepository) {
		this.billRepository = billRepository;
	}

	@RequireRole(Role.ADMIN)
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

	@RequireRole(Role.ADMIN)
	@DeleteMapping
	public ResponseEntity<?> deleteMany(@RequestBody(required = false) List<Long> ids) {
		if (ids == null) {
			billRepository.deleteAll();
			return ResponseEntity.ok().build();
		}
		billRepository.deleteAll(billRepository.findAllById(ids));
		return ResponseEntity.ok().build();
	}

	@RequireRole(Role.ADMIN)
	@GetMapping("/{id}")
	public ResponseEntity<Bill> getById(@PathVariable Long id) {
		return ResponseEntity.ok(billRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no bill with id " + id)));
	}

	@RequireRole(Role.ADMIN)
	@PutMapping("/{id}")
	public ResponseEntity<Bill> update(@PathVariable Long id, @RequestBody Bill bill) {
		billRepository.findById(id).orElseThrow(() -> new NotFoundException("no bill with id " + id));
		return ResponseEntity.ok(billRepository.save(bill));
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		billRepository.findById(id).orElseThrow(() -> new NotFoundException("no bill with id " + id));
		billRepository.deleteById(id);
		return ResponseEntity.ok().build();
	}

	@GetMapping("/user/{id}")
	public ResponseEntity<List<Bill>> getByUserId(@PathVariable Long id, HttpServletRequest request) {
		if (!Auth.ownIdOrAdmin(id, request)) {
			throw new ForbiddenException("only the owner or an admin may read these bills");
		}
		return ResponseEntity.ok(billRepository.findByUserId(id));
	}
}
