package com.lavantien.flowershop.api.order;

import com.lavantien.flowershop.api.PageDto;
import com.lavantien.flowershop.api.PageQuery;
import com.lavantien.flowershop.api.error.ForbiddenException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.security.Auth;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.service.OrderService;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/order")
public class OrderController {
	static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "id");

	private final OrderRepository orderRepository;
	private final OrderService orderService;

	public OrderController(OrderRepository orderRepository, OrderService orderService) {
		this.orderRepository = orderRepository;
		this.orderService = orderService;
	}

	@PostMapping
	public ResponseEntity<CheckoutResponse> checkout(@Valid @RequestBody CheckoutRequest request,
		HttpServletRequest httpRequest) {
		return ResponseEntity.status(HttpStatus.CREATED)
			.body(orderService.checkout(Auth.userId(httpRequest), request));
	}

	@GetMapping("/me")
	public PageDto<OrderView> myOrders(@RequestParam(required = false) Integer page,
		@RequestParam(required = false) Integer size, HttpServletRequest request) {
		PageQuery query = PageQuery.of(page, size);
		Page<Order> orders = orderRepository.findByUserId(Auth.userId(request),
			PageRequest.of(query.page(), query.size(), NEWEST_FIRST));
		return PageDto.from(orders, orderService::view);
	}

	@RequireRole(Role.ADMIN)
	@GetMapping
	public PageDto<OrderView> getAll(@RequestParam(required = false) String status,
		@RequestParam(required = false) String from, @RequestParam(required = false) String to,
		@RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
		PageQuery query = PageQuery.of(page, size);
		Page<Order> orders = orderRepository.findAll(
			adminSpecification(parseStatus(status), parseInstant(from, false), parseInstant(to, true)),
			PageRequest.of(query.page(), query.size(), NEWEST_FIRST));
		return PageDto.from(orders, orderService::view);
	}

	@GetMapping("/{id}")
	public OrderView getById(@PathVariable Long id, HttpServletRequest request) {
		Order order = orderRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no order with id " + id));
		if (!Auth.ownIdOrAdmin(order.getUserId(), request)) {
			throw new ForbiddenException("only the owner or an admin may read this order");
		}
		return orderService.view(order);
	}

	@PostMapping("/{id}/cancel")
	public OrderView cancel(@PathVariable Long id, HttpServletRequest request) {
		return orderService.cancel(id, Auth.userId(request), Auth.isAdmin(request));
	}

	@RequireRole(Role.ADMIN)
	@PostMapping("/{id}/status")
	public OrderView changeStatus(@PathVariable Long id, @Valid @RequestBody StatusRequest body) {
		return orderService.changeStatus(id, body.status());
	}

	public record StatusRequest(@NotNull(message = "is required") OrderStatus status) {}

	static Specification<Order> adminSpecification(OrderStatus status, Instant from, Instant to) {
		return (root, _, builder) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (status != null) {
				predicates.add(builder.equal(root.<OrderStatus>get("status"), status));
			}
			if (from != null) {
				predicates.add(builder.greaterThanOrEqualTo(root.<Instant>get("placedAt"), from));
			}
			if (to != null) {
				predicates.add(builder.lessThan(root.<Instant>get("placedAt"), to));
			}
			return builder.and(predicates.toArray(new Predicate[0]));
		};
	}

	static OrderStatus parseStatus(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		try {
			return OrderStatus.valueOf(raw.strip().toUpperCase(Locale.ROOT));
		} catch (IllegalArgumentException unknown) {
			return null;
		}
	}

	static Instant parseInstant(String raw, boolean endExclusive) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		try {
			LocalDate day = LocalDate.parse(raw.strip());
			return (endExclusive ? day.plusDays(1) : day).atStartOfDay(ZoneOffset.UTC).toInstant();
		} catch (DateTimeParseException ignored) {
			return null;
		}
	}
}
