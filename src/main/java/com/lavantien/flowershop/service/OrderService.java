package com.lavantien.flowershop.service;

import com.lavantien.flowershop.api.branch.Branch;
import com.lavantien.flowershop.api.branch.BranchRepository;
import com.lavantien.flowershop.api.branch.StockLevel;
import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.coupon.Coupon;
import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.error.ForbiddenException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.error.UnauthenticatedException;
import com.lavantien.flowershop.api.order.CheckoutRequest;
import com.lavantien.flowershop.api.order.CheckoutResponse;
import com.lavantien.flowershop.api.order.Order;
import com.lavantien.flowershop.api.order.OrderItem;
import com.lavantien.flowershop.api.order.OrderItemRepository;
import com.lavantien.flowershop.api.order.OrderRepository;
import com.lavantien.flowershop.api.order.OrderStatus;
import com.lavantien.flowershop.api.order.OrderView;
import com.lavantien.flowershop.api.payment.PaymentOutcome;
import com.lavantien.flowershop.api.payment.PaymentRedirect;
import com.lavantien.flowershop.api.payment.PaymentSession;
import com.lavantien.flowershop.api.payment.PaymentStatus;
import com.lavantien.flowershop.api.payment.PaymentSessionRepository;
import com.lavantien.flowershop.api.payment.PaymentView;
import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class OrderService {
	private record Line(Product product, int quantity, BigDecimal lineTotal) {}

	private final OrderRepository orderRepository;
	private final OrderItemRepository orderItemRepository;
	private final ProductRepository productRepository;
	private final BranchRepository branchRepository;
	private final StockLevelRepository stockLevelRepository;
	private final PaymentSessionRepository paymentSessionRepository;
	private final PaymentService paymentService;
	private final GeoService geoService;
	private final CouponService couponService;
	private final ShopProperties properties;

	public OrderService(OrderRepository orderRepository, OrderItemRepository orderItemRepository,
		ProductRepository productRepository, BranchRepository branchRepository,
		StockLevelRepository stockLevelRepository, PaymentSessionRepository paymentSessionRepository,
		PaymentService paymentService, GeoService geoService, CouponService couponService,
		ShopProperties properties) {
		this.orderRepository = orderRepository;
		this.orderItemRepository = orderItemRepository;
		this.productRepository = productRepository;
		this.branchRepository = branchRepository;
		this.stockLevelRepository = stockLevelRepository;
		this.paymentSessionRepository = paymentSessionRepository;
		this.paymentService = paymentService;
		this.geoService = geoService;
		this.couponService = couponService;
		this.properties = properties;
	}

	@Transactional
	public CheckoutResponse checkout(Long userId, CheckoutRequest request) {
		Map<Long, Integer> quantities = mergedQuantities(request.items());
		Map<Long, Product> products = productsById(quantities.keySet());
		GeoService.Point target = geoService.resolve(request.district(), request.city());
		Branch branch = resolveBranch(request, target);
		double distanceKm = geoService.distanceKm(
			new GeoService.Point(branch.getLat(), branch.getLng()), target);
		BigDecimal deliveryFee = BigDecimal.valueOf(geoService.deliveryFee(distanceKm));

		List<Line> lines = new ArrayList<>(quantities.size());
		BigDecimal subtotal = BigDecimal.ZERO;
		for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
			Product product = products.get(entry.getKey());
			BigDecimal lineTotal = product.getPrice().multiply(BigDecimal.valueOf(entry.getValue()));
			subtotal = subtotal.add(lineTotal);
			lines.add(new Line(product, entry.getValue(), lineTotal));
		}
		lines.sort(Comparator.comparing(line -> line.product().getId()));

		List<String> failing = new ArrayList<>();
		for (Line line : lines) {
			StockLevel row = stockLevelRepository
				.findByBranchIdAndProductId(branch.getId(), line.product().getId()).orElse(null);
			if (row == null || stockLevelRepository.decrementIfAvailable(row.getId(), line.quantity()) == 0) {
				failing.add(line.product().getName());
			}
		}
		if (!failing.isEmpty()) {
			throw new ConflictException("OUT_OF_STOCK", "insufficient stock for: " + String.join(", ", failing));
		}

		String couponCode = blankToNull(request.couponCode());
		BigDecimal discountAmount = BigDecimal.ZERO;
		if (couponCode != null) {
			Coupon coupon = couponService.resolve(couponCode);
			discountAmount = properties.delivery().round(coupon.discountOn(subtotal)).min(subtotal);
		}
		BigDecimal total = subtotal.subtract(discountAmount).add(deliveryFee);
		Order order = new Order(userId, request.phone(), request.address(), request.district(), request.city(),
			branch.getId(), distanceKm, deliveryFee, couponCode, discountAmount,
			subtotal, total);
		Instant now = Instant.now();
		order.setPlacedAt(now);
		order = orderRepository.save(order);

		Long orderId = order.getId();
		List<OrderItem> items = orderItemRepository.saveAll(lines.stream()
			.map(line -> new OrderItem(orderId, line.product().getId(), line.product().getName(),
				line.product().getPrice(), line.quantity(), line.lineTotal()))
			.toList());

		PaymentSession session = new PaymentSession(UUID.randomUUID().toString(), orderId, total);
		session.start(now);
		paymentSessionRepository.save(session);
		return new CheckoutResponse(OrderView.of(order, items, branch.getName()),
			new PaymentRedirect(session.getId(), paymentService.redirectUrl(session)));
	}

	public OrderView view(Order order) {
		List<OrderItem> items = orderItemRepository.findByOrderId(order.getId());
		String branchName = order.getBranchId() == null ? null
			: branchRepository.findById(order.getBranchId()).map(Branch::getName).orElse(null);
		return OrderView.of(order, items, branchName);
	}

	@Transactional(readOnly = true)
	public PaymentView paymentView(String paymentId, String sig) {
		PaymentSession session = paymentSessionRepository.findById(paymentId)
			.orElseThrow(() -> new NotFoundException("no payment with id " + paymentId));
		requireSignature(session, sig);
		return PaymentView.of(session);
	}

	@Transactional
	public PaymentOutcome confirmPayment(String paymentId, String sig) {
		PaymentSession session = paymentSessionRepository.lockById(paymentId)
			.orElseThrow(() -> new NotFoundException("no payment with id " + paymentId));
		requireSignature(session, sig);
		return switch (session.getStatus()) {
			case CONFIRMED -> new PaymentOutcome(session.getOrderId(), PaymentStatus.CONFIRMED);
			case CANCELLED -> throw new ConflictException("PAYMENT_CANCELLED",
				"payment " + paymentId + " was cancelled and can no longer be confirmed");
			case PENDING -> {
				Order order = orderRepository.lockById(session.getOrderId())
					.orElseThrow(() -> new NotFoundException("no order with id " + session.getOrderId()));
				Instant now = Instant.now();
				session.confirm(now);
				if (order.getStatus() == OrderStatus.PENDING) {
					order.transitionTo(OrderStatus.PAID, now);
				}
				yield new PaymentOutcome(session.getOrderId(), PaymentStatus.CONFIRMED);
			}
		};
	}

	@Transactional
	public PaymentOutcome cancelPayment(String paymentId, String sig) {
		PaymentSession session = paymentSessionRepository.lockById(paymentId)
			.orElseThrow(() -> new NotFoundException("no payment with id " + paymentId));
		requireSignature(session, sig);
		return switch (session.getStatus()) {
			case CANCELLED -> new PaymentOutcome(session.getOrderId(), PaymentStatus.CANCELLED);
			case CONFIRMED -> throw new ConflictException("PAYMENT_CONFIRMED",
				"payment " + paymentId + " is already confirmed and cannot be cancelled");
			case PENDING -> {
				Order order = orderRepository.lockById(session.getOrderId())
					.orElseThrow(() -> new NotFoundException("no order with id " + session.getOrderId()));
				Instant now = Instant.now();
				session.cancel(now);
				if (order.getStatus() == OrderStatus.PENDING) {
					order.transitionTo(OrderStatus.CANCELLED, now);
					restoreStock(order);
				}
				yield new PaymentOutcome(session.getOrderId(), PaymentStatus.CANCELLED);
			}
		};
	}

	@Transactional
	public OrderView cancel(Long orderId, Long actingUserId, boolean admin) {
		PaymentSession payment = paymentSessionRepository.lockByOrderId(orderId).orElse(null);
		Order order = orderRepository.lockById(orderId)
			.orElseThrow(() -> new NotFoundException("no order with id " + orderId));
		if (!admin && !actingUserId.equals(order.getUserId())) {
			throw new ForbiddenException("only the owner or an admin may cancel this order");
		}
		if (!order.getStatus().canTransitionTo(OrderStatus.CANCELLED)
				|| (!admin && order.getStatus() != OrderStatus.PENDING)) {
			throw new ConflictException("ILLEGAL_TRANSITION",
				"an order in " + order.getStatus() + " cannot be cancelled");
		}
		Instant now = Instant.now();
		order.transitionTo(OrderStatus.CANCELLED, now);
		if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
			payment.cancel(now);
		}
		restoreStock(order);
		return view(order);
	}

	@Transactional
	public OrderView changeStatus(Long orderId, OrderStatus next) {
		PaymentSession payment = paymentSessionRepository.lockByOrderId(orderId).orElse(null);
		Order order = orderRepository.lockById(orderId)
			.orElseThrow(() -> new NotFoundException("no order with id " + orderId));
		if (!order.getStatus().canTransitionTo(next)) {
			throw new ConflictException("ILLEGAL_TRANSITION",
				"an order in " + order.getStatus() + " cannot move to " + next);
		}
		if (order.getStatus() == OrderStatus.PENDING && next == OrderStatus.PAID) {
			throw new ConflictException("ILLEGAL_TRANSITION",
				"an order only turns PAID through the payment confirm flow");
		}
		if (next == OrderStatus.CANCELLED) {
			if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
				payment.cancel(Instant.now());
			}
			restoreStock(order);
		}
		order.transitionTo(next, Instant.now());
		return view(order);
	}

	private void requireSignature(PaymentSession session, String sig) {
		if (!paymentService.matches(session, sig)) {
			throw new UnauthenticatedException("the payment signature is invalid");
		}
	}

	private void restoreStock(Order order) {
		List<OrderItem> items = new ArrayList<>(orderItemRepository.findByOrderId(order.getId()));
		items.sort(Comparator.comparing(OrderItem::getProductId));
		for (OrderItem item : items) {
			StockLevel row = stockLevelRepository
				.findByBranchIdAndProductId(order.getBranchId(), item.getProductId()).orElse(null);
			if (row == null) {
				stockLevelRepository.save(new StockLevel(order.getBranchId(), item.getProductId(),
					item.getQuantity()));
			} else {
				stockLevelRepository.increment(row.getId(), item.getQuantity());
			}
		}
	}

	private static Map<Long, Integer> mergedQuantities(List<CheckoutRequest.Item> items) {
		Map<Long, Integer> merged = new LinkedHashMap<>();
		for (CheckoutRequest.Item item : items) {
			merged.merge(item.productId(), item.quantity(), Integer::sum);
		}
		return merged;
	}

	private Map<Long, Product> productsById(Set<Long> ids) {
		Map<Long, Product> products = productRepository.findAllById(ids).stream()
			.collect(Collectors.toMap(Product::getId, Function.identity()));
		for (Long id : ids) {
			if (!products.containsKey(id)) {
				throw new NotFoundException("no product with id " + id);
			}
		}
		return products;
	}

	private Branch resolveBranch(CheckoutRequest request, GeoService.Point target) {
		if (request.branchId() != null) {
			Branch branch = branchRepository.findById(request.branchId())
				.orElseThrow(() -> new NotFoundException("no branch with id " + request.branchId()));
			if (!Boolean.TRUE.equals(branch.getActive()) || branch.getLat() == null || branch.getLng() == null) {
				throw new NotFoundException("no active branch with id " + request.branchId()
					+ " and coordinates to fulfill the order");
			}
			return branch;
		}
		Branch nearest = geoService.nearestBranch(branchRepository.findAll(), target);
		if (nearest == null) {
			throw new NotFoundException("no active branch with coordinates to fulfill the order");
		}
		return nearest;
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}
}
