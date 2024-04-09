package com.lavantien.flowershop.api.bill;

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

	@GetMapping
	public ResponseEntity<List<Bill>> getAll() {
		return ResponseEntity.ok(billRepository.findAll());
	}

	@PostMapping
	public ResponseEntity<List<Bill>> createMany(@RequestBody List<Bill> bills) {
		return ResponseEntity.ok(billRepository.saveAll(bills));
	}

	@DeleteMapping
	public ResponseEntity<?> deleteMany(@RequestBody(required = false) List<Long> ids) {
		if (ids == null) {
			billRepository.deleteAll();
			return ResponseEntity.ok().build();
		}
		billRepository.deleteAll(billRepository.findAllById(ids));
		return ResponseEntity.ok().build();
	}

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

	@PutMapping("/{id}")
	public ResponseEntity<Bill> update(@PathVariable Long id, @RequestBody Bill bill) {
		if (billRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(billRepository.save(bill));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		if (billRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		billRepository.deleteById(id);
		return ResponseEntity.ok().build();
	}

	@GetMapping("/user/{id}")
	public ResponseEntity<List<Bill>> getByUserId(@PathVariable Long id) {
		List<Bill> bills = billRepository.findByUserId(id);
		if (bills.isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(bills);
	}
}
