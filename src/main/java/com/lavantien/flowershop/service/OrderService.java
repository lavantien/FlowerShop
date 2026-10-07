package com.lavantien.flowershop.service;

import com.lavantien.flowershop.api.branch.Branch;
import com.lavantien.flowershop.api.branch.BranchRepository;
import com.lavantien.flowershop.api.branch.StockLevel;
import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.order.CheckoutRequest;
import com.lavantien.flowershop.api.order.Order;
import com.lavantien.flowershop.api.order.OrderItem;
import com.lavantien.flowershop.api.order.OrderItemRepository;
import com.lavantien.flowershop.api.order.OrderRepository;
import com.lavantien.flowershop.api.order.OrderView;
import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
	private final GeoService geoService;

	public OrderService(OrderRepository orderRepository, OrderItemRepository orderItemRepository,
		ProductRepository productRepository, BranchRepository branchRepository,
		StockLevelRepository stockLevelRepository, GeoService geoService) {
		this.orderRepository = orderRepository;
		this.orderItemRepository = orderItemRepository;
		this.productRepository = productRepository;
		this.branchRepository = branchRepository;
		this.stockLevelRepository = stockLevelRepository;
		this.geoService = geoService;
	}

	// One transaction prices every line from the database, snapshots name and
	// price into order_item, resolves the branch, decrements stock through the
	// single conditional update, and writes the order PENDING.
	@Transactional
	public OrderView checkout(Long userId, CheckoutRequest request) {
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

		// The stock guard: a shortfall on any line rolls the whole cart back
		// and the detail names every failing item.
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

		// Coupons land in their own commit; for now the code is only stored
		// and the discount stays zero.
		BigDecimal discountAmount = BigDecimal.ZERO;
		BigDecimal total = subtotal.subtract(discountAmount).add(deliveryFee);
		Order order = new Order(userId, request.phone(), request.address(), request.district(), request.city(),
			branch.getId(), distanceKm, deliveryFee, blankToNull(request.couponCode()), discountAmount,
			subtotal, total);
		order.setPlacedAt(Instant.now());
		order = orderRepository.save(order);

		Long orderId = order.getId();
		List<OrderItem> items = orderItemRepository.saveAll(lines.stream()
			.map(line -> new OrderItem(orderId, line.product().getId(), line.product().getName(),
				line.product().getPrice(), line.quantity(), line.lineTotal()))
			.toList());
		return OrderView.of(order, items, branch.getName());
	}

	public OrderView view(Order order) {
		List<OrderItem> items = orderItemRepository.findByOrderId(order.getId());
		String branchName = order.getBranchId() == null ? null
			: branchRepository.findById(order.getBranchId()).map(Branch::getName).orElse(null);
		return OrderView.of(order, items, branchName);
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
			return branchRepository.findById(request.branchId())
				.orElseThrow(() -> new NotFoundException("no branch with id " + request.branchId()));
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
