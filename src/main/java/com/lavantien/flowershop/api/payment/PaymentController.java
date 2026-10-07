package com.lavantien.flowershop.api.payment;

import com.lavantien.flowershop.service.OrderService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// Every route here is public on the wire and gated on the HMAC signature
// instead of a session token: a bad or missing sig is a 401 before any
// state is touched.
@RestController
@RequestMapping("/api/payment")
public class PaymentController {
	private final OrderService orderService;

	public PaymentController(OrderService orderService) {
		this.orderService = orderService;
	}

	@GetMapping("/{id}")
	public PaymentView get(@PathVariable String id, @RequestParam(required = false) String sig) {
		return orderService.paymentView(id, sig);
	}

	@PostMapping("/{id}/confirm")
	public PaymentOutcome confirm(@PathVariable String id, @RequestParam(required = false) String sig) {
		return orderService.confirmPayment(id, sig);
	}

	@PostMapping("/{id}/cancel")
	public PaymentOutcome cancel(@PathVariable String id, @RequestParam(required = false) String sig) {
		return orderService.cancelPayment(id, sig);
	}
}
