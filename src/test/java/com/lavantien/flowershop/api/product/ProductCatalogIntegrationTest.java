package com.lavantien.flowershop.api.product;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

// The standalone suite pins controller shapes with mocked repositories; this
// class runs the Specification, the sort whitelist, and the paging clamps
// through the controller's own query pipeline against the real MySQL, so the
// generated SQL is the thing under test.
@SpringBootTest
@Transactional
class ProductCatalogIntegrationTest {
	@Autowired
	private ProductRepository productRepository;

	private Page<Product> run(String search, String category, String type, String sort, Integer page, Integer size) {
		ProductController.CatalogQuery query = ProductController.CatalogQuery.of(search, category, type, sort, page, size);
		return productRepository.findAll(ProductController.catalogSpecification(query),
			PageRequest.of(query.page(), query.size(), query.sort()));
	}

	private static List<String> names(Page<Product> page) {
		return page.getContent().stream().map(Product::getName).toList();
	}

	private static List<Long> prices(Page<Product> page) {
		return page.getContent().stream().map(product -> product.getPrice().longValueExact()).toList();
	}

	private Product persist(String name, String price, String type, String category) {
		return productRepository.save(new Product(name, "integration row", "https://cdn.example/integration.jpg",
			new BigDecimal(price), type, category));
	}

	@Test
	void searchMatchesASubstringOfTheNameCaseInsensitively() {
		persist("Integration Red Rose", "100000", "IT-T", "IT-SEARCH");
		persist("Integration White Tulip", "200000", "IT-T", "IT-SEARCH");
		persist("Integration rose Preserved", "300000", "IT-T", "IT-SEARCH");

		Page<Product> page = run("rOsE", "IT-SEARCH", null, null, null, null);
		assertEquals(2, page.getTotalElements());
		assertEquals(List.of("Integration Red Rose", "Integration rose Preserved"), names(page));
	}

	@Test
	void categoryAndTypeMatchExactlyNotAsSubstrings() {
		persist("Exact Category A", "100000", "IT-T1", "ITEXACT");
		persist("Exact Category B", "100000", "IT-T1", "ITEXACTLY");
		persist("Exact Type A", "100000", "ITTEXACT", "IT-TYPE");
		persist("Exact Type B", "100000", "ITTEXACTLY", "IT-TYPE");

		assertEquals(List.of("Exact Category A"), names(run(null, "ITEXACT", null, null, null, null)));
		assertEquals(List.of("Exact Type A"), names(run(null, null, "ITTEXACT", null, null, null)));
	}

	@Test
	void combinedFiltersIntersect() {
		persist("Combo Rose One", "100000", "IT-T", "IT-COMBO");
		persist("Combo Tulip Two", "200000", "IT-T2", "IT-COMBO");

		assertEquals(List.of("Combo Tulip Two"), names(run("Tulip", "IT-COMBO", "IT-T2", null, null, null)));
	}

	@Test
	void thePriceSortWhitelistOrdersThePage() {
		persist("Sort Bravo", "300000", "IT-T", "IT-PRICE");
		persist("Sort Charlie", "100000", "IT-T", "IT-PRICE");
		persist("Sort Alpha", "200000", "IT-T", "IT-PRICE");

		assertEquals(List.of(100000L, 200000L, 300000L), prices(run(null, "IT-PRICE", null, "price-asc", null, null)));
		assertEquals(List.of(300000L, 200000L, 100000L), prices(run(null, "IT-PRICE", null, "price-desc", null, null)));
	}

	@Test
	void pagingServesSecondPagesAndClampsSilently() {
		persist("Page Alpha", "100000", "IT-T", "IT-PAGE");
		persist("Page Beta", "100000", "IT-T", "IT-PAGE");
		persist("Page Gamma", "100000", "IT-T", "IT-PAGE");

		Page<Product> secondPage = run(null, "IT-PAGE", null, null, 1, 2);
		assertEquals(3, secondPage.getTotalElements());
		assertEquals(2, secondPage.getTotalPages());
		assertEquals(1, secondPage.getNumber());
		assertEquals(2, secondPage.getSize());
		assertEquals(List.of("Page Gamma"), names(secondPage));

		assertEquals(48, run(null, "IT-PAGE", null, null, 0, 500).getSize());
		Page<Product> clamped = run(null, "IT-PAGE", null, null, -4, 0);
		assertEquals(0, clamped.getNumber());
		assertEquals(1, clamped.getSize());
	}
}
