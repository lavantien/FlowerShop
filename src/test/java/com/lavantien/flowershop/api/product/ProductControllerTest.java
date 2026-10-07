package com.lavantien.flowershop.api.product;

import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.ProductService;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ProductControllerTest {
	private ProductRepository productRepository;
	private StockLevelRepository stockLevelRepository;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		productRepository = mock(ProductRepository.class);
		stockLevelRepository = mock(StockLevelRepository.class);
		UserRepository userRepository = mock(UserRepository.class);
		UserService userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(
				new ProductController(productRepository, stockLevelRepository, new ProductService(productRepository)))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
	}

	private static Product rose() {
		Product product = new Product("Rose", "A dozen red roses", "https://cdn.example/rose.jpg",
			BigDecimal.valueOf(288000), "ROSES", "BOUQUET");
		product.setId(2L);
		return product;
	}

	@Test
	void anonymousBrowsesTheFirstPageOfTheCatalog() throws Exception {
		when(productRepository.findAll(any(Specification.class), any(Pageable.class)))
			.thenReturn(new PageImpl<>(List.of(rose()), PageRequest.of(0, 12), 1));
		when(stockLevelRepository.sumQuantityByProductId(2L)).thenReturn(40L);

		mockMvc.perform(get("/api/product"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content[0].id").value(2))
			.andExpect(jsonPath("$.content[0].name").value("Rose"))
			.andExpect(jsonPath("$.content[0].description").value("A dozen red roses"))
			.andExpect(jsonPath("$.content[0].imgUrl").value("https://cdn.example/rose.jpg"))
			.andExpect(jsonPath("$.content[0].price").value(288000))
			.andExpect(jsonPath("$.content[0].typeName").value("ROSES"))
			.andExpect(jsonPath("$.content[0].categoryName").value("BOUQUET"))
			.andExpect(jsonPath("$.content[0].stock").value(40))
			.andExpect(jsonPath("$.content[0].quantity").doesNotExist())
			.andExpect(jsonPath("$.content[0].saleAmount").doesNotExist())
			.andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.totalPages").value(1))
			.andExpect(jsonPath("$.page").value(0))
			.andExpect(jsonPath("$.size").value(12));

		ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
		verify(productRepository).findAll(any(Specification.class), pageable.capture());
		assertEquals(0, pageable.getValue().getPageNumber());
		assertEquals(12, pageable.getValue().getPageSize());
		assertEquals(Sort.by(Sort.Direction.ASC, "name"), pageable.getValue().getSort());
	}

	@Test
	void filterParamsReachTheRepositoryWithTheDefaultPage() throws Exception {
		when(productRepository.findAll(any(Specification.class), any(Pageable.class)))
			.thenReturn(Page.empty());

		mockMvc.perform(get("/api/product").param("search", "rose").param("category", "BOUQUET")
				.param("type", "ROSES").param("sort", "price-desc").param("page", "3").param("size", "24"))
			.andExpect(status().isOk());

		ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
		verify(productRepository).findAll(any(Specification.class), pageable.capture());
		assertEquals(3, pageable.getValue().getPageNumber());
		assertEquals(24, pageable.getValue().getPageSize());
		assertEquals(Sort.by(Sort.Direction.DESC, "price"), pageable.getValue().getSort());
	}

	@Test
	void catalogQueryClampsPageAndSizeSilently() {
		var query = ProductController.CatalogQuery.of(null, null, null, null, null, null);
		assertEquals(0, query.page());
		assertEquals(12, query.size());
		assertEquals(Sort.by(Sort.Direction.ASC, "name"), query.sort());

		assertEquals(0, ProductController.CatalogQuery.of(null, null, null, null, -5, -3).page());
		assertEquals(1, ProductController.CatalogQuery.of(null, null, null, null, 0, 0).size());
		assertEquals(48, ProductController.CatalogQuery.of(null, null, null, null, 9, 500).size());
		assertEquals(48, ProductController.CatalogQuery.of(null, null, null, null, 9, 48).size());
		assertEquals(1, ProductController.CatalogQuery.of(null, null, null, null, 9, 1).size());
		assertEquals(7, ProductController.CatalogQuery.of(null, null, null, null, 7, 20).page());
		assertEquals(44739241, ProductController.CatalogQuery.of(null, null, null, null, 2147483647, 48).page(),
			"an int-overflowing page must clamp into offset range, not 500 at the data layer");
	}

	@Test
	void anOverflowingCatalogPageAnswersAnEmptyPageNotA500() throws Exception {
		when(productRepository.findAll(any(Specification.class), any(Pageable.class)))
			.thenReturn(Page.empty());

		mockMvc.perform(get("/api/product").param("page", "2147483647").param("size", "48"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content").isEmpty())
			.andExpect(jsonPath("$.totalElements").value(0));

		ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
		verify(productRepository).findAll(any(Specification.class), pageable.capture());
		assertTrue(pageable.getValue().getOffset() + pageable.getValue().getPageSize() <= Integer.MAX_VALUE,
			"the pageable handed to Spring Data must keep its offset inside int range");
	}

	@Test
	void sortWhitelistMapsOnlyKnownValues() {
		assertEquals(Sort.by(Sort.Direction.ASC, "name"), ProductController.CatalogQuery.of(null, null, null, null, null, null).sort());
		assertEquals(Sort.by(Sort.Direction.DESC, "name"), ProductController.CatalogQuery.of(null, null, null, "name-desc", null, null).sort());
		assertEquals(Sort.by(Sort.Direction.ASC, "price"), ProductController.CatalogQuery.of(null, null, null, "price-asc", null, null).sort());
		assertEquals(Sort.by(Sort.Direction.DESC, "price"), ProductController.CatalogQuery.of(null, null, null, "price-desc", null, null).sort());
		assertEquals(Sort.by(Sort.Direction.ASC, "name"), ProductController.CatalogQuery.of(null, null, null, "name-asc", null, null).sort());
		assertEquals(Sort.by(Sort.Direction.ASC, "name"), ProductController.CatalogQuery.of(null, null, null, "DROP TABLE", null, null).sort());
	}

	@Test
	void catalogQueryStripsAndBlanksFilters() {
		var query = ProductController.CatalogQuery.of("  rose ", "  ", "", "  price-asc ", null, null);
		assertEquals("rose", query.search());
		assertEquals(null, query.category());
		assertEquals(null, query.type());
		assertEquals(Sort.by(Sort.Direction.ASC, "price"), query.sort());
	}

	@Test
	void productIsFoundById() throws Exception {
		when(productRepository.findById(2L)).thenReturn(Optional.of(rose()));
		when(stockLevelRepository.sumQuantityByProductId(2L)).thenReturn(40L);

		mockMvc.perform(get("/api/product/2"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Rose"))
			.andExpect(jsonPath("$.price").value(288000))
			.andExpect(jsonPath("$.stock").value(40))
			.andExpect(jsonPath("$.categoryName").value("BOUQUET"));
	}

	@Test
	void missingProductAnswersNotFound() throws Exception {
		when(productRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/product/99"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void adminSeedsRowsWithoutAnIdThroughSave() throws Exception {
		when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"name\":\"Rose\",\"price\":288000}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].name").value("Rose"));

		ArgumentCaptor<Product> saved = ArgumentCaptor.forClass(Product.class);
		verify(productRepository).save(saved.capture());
		assertTrue(saved.getValue().getId() == null, "a row without an id must go through the save merge path");
		assertEquals(BigDecimal.valueOf(288000), saved.getValue().getPrice());
		assertTrue(saved.getValue().toString().contains("name='Rose'"), "toString must render the persisted fields");
	}

	@Test
	void bulkUpsertNormalizesPricesToWholeDong() throws Exception {
		when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"name\":\"Rose\",\"price\":288499.9}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].price").value(288500));

		ArgumentCaptor<Product> saved = ArgumentCaptor.forClass(Product.class);
		verify(productRepository).save(saved.capture());
		assertEquals(BigDecimal.valueOf(288500), saved.getValue().getPrice());
	}

	@Test
	void adminUpsertsAnExplicitExistingIdAsAMerge() throws Exception {
		when(productRepository.existsById(2L)).thenReturn(true);
		when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"id\":2,\"name\":\"Rose\",\"price\":350000}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].price").value(350000));

		verify(productRepository).save(any(Product.class));
		verify(productRepository, never()).insertWithId(any(Product.class));
	}

	@Test
	void adminInsertsAnExplicitNewIdNatively() throws Exception {
		when(productRepository.existsById(9L)).thenReturn(false);
		when(productRepository.findById(9L)).thenReturn(Optional.of(rose()));

		mockMvc.perform(post("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"id\":9,\"name\":\"Rose\",\"price\":288000}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].name").value("Rose"));

		ArgumentCaptor<Product> inserted = ArgumentCaptor.forClass(Product.class);
		verify(productRepository).insertWithId(inserted.capture());
		assertTrue(inserted.getValue().getId().equals(9L), "the native insert must honor the submitted id");
	}

	@Test
	void anInsertedRowFallsBackToTheSubmittedProductWhenTheReadMisses() throws Exception {
		when(productRepository.existsById(9L)).thenReturn(false);
		when(productRepository.findById(9L)).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"id\":9,\"name\":\"Rose\",\"price\":288000}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].name").value("Rose"))
			.andExpect(jsonPath("$[0].id").value(9));
	}

	@Test
	void createManyRetriesAsUpdatesWhenARaceInsertsTheSameIdFirst() throws Exception {
		when(productRepository.existsById(2L))
			.thenThrow(new DataIntegrityViolationException("duplicate key"))
			.thenReturn(true);
		when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"id\":2,\"name\":\"Rose\",\"price\":288000}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].name").value("Rose"));

		verify(productRepository).save(any(Product.class));
		verify(productRepository, never()).insertWithId(any(Product.class));
	}

	@Test
	void deleteManyWithoutABodyWipesTheCatalog() throws Exception {
		mockMvc.perform(delete("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNoContent());

		verify(productRepository).deleteAll();
	}

	@Test
	void deleteManyWithIdsDeletesOnlyThoseRows() throws Exception {
		when(productRepository.findAllById(List.of(2L, 3L))).thenReturn(List.of(rose()));

		mockMvc.perform(delete("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[2,3]"))
			.andExpect(status().isNoContent());

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<Product>> deleted = ArgumentCaptor.forClass(List.class);
		verify(productRepository).deleteAll(deleted.capture());
		assertTrue(deleted.getValue().size() == 1, "only the rows resolved from the submitted ids are deleted");
		assertTrue(deleted.getValue().get(0).getId().equals(2L));
	}

	@Test
	void createPersistsTheSubmittedProduct() throws Exception {
		when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/product/create").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Rose\",\"price\":288000,\"typeName\":\"ROSES\",\"categoryName\":\"BOUQUET\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Rose"))
			.andExpect(jsonPath("$.price").value(288000))
			.andExpect(jsonPath("$.stock").value(0));

		ArgumentCaptor<Product> saved = ArgumentCaptor.forClass(Product.class);
		verify(productRepository).save(saved.capture());
		assertTrue(saved.getValue().getName().equals("Rose"), "the created product must reach the repository");
	}

	@Test
	void createRejectsAMissingNameOrPrice() throws Exception {
		mockMvc.perform(post("/api/product/create").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"price\":288000}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.name").value("must not be blank"));
		mockMvc.perform(post("/api/product/create").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Rose\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.price").value("must not be null"));
	}

	@Test
	void adminCannotCreateAProductWithAZeroOrNegativePrice() throws Exception {
		for (String price : new String[]{"0", "-1000"}) {
			mockMvc.perform(post("/api/product/create").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"name\":\"Rose\",\"price\":" + price + "}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION"))
				.andExpect(jsonPath("$.errors.price").value("must be greater than 0"));
		}

		verify(productRepository, never()).save(any(Product.class));
	}

	@Test
	void adminCannotUpdateAProductToAZeroOrNegativePrice() throws Exception {
		when(productRepository.findById(2L)).thenReturn(Optional.of(rose()));

		for (String price : new String[]{"0", "-1000"}) {
			mockMvc.perform(put("/api/product/2").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"name\":\"Rose\",\"price\":" + price + "}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION"))
				.andExpect(jsonPath("$.errors.price").value("must be greater than 0"));
		}

		verify(productRepository, never()).save(any(Product.class));
	}

	@Test
	void bulkUpsertRejectsAZeroOrNegativePriceInTheList() throws Exception {
		mockMvc.perform(post("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"name\":\"Rose\",\"price\":-5},{\"name\":\"Tulip\",\"price\":100000}]"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"));

		verify(productRepository, never()).save(any(Product.class));
	}

	@Test
	void updateReplacesTheRowWithThePathId() throws Exception {
		when(productRepository.findById(2L)).thenReturn(Optional.of(rose()));
		when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/product/2").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"id\":77,\"name\":\"Tulip\",\"description\":\"Fresh cut\",\"imgUrl\":\"https://cdn.example/tulip.jpg\","
					+ "\"price\":199000,\"typeName\":\"TULIPS\",\"categoryName\":\"POTTED\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Tulip"));

		ArgumentCaptor<Product> saved = ArgumentCaptor.forClass(Product.class);
		verify(productRepository).save(saved.capture());
		assertTrue(saved.getValue().getId().equals(2L), "the path id must win over any body id");
		assertTrue(saved.getValue().getName().equals("Tulip"));
		assertTrue(saved.getValue().getDescription().equals("Fresh cut"));
		assertTrue(saved.getValue().getImgUrl().equals("https://cdn.example/tulip.jpg"));
		assertEquals(BigDecimal.valueOf(199000), saved.getValue().getPrice());
		assertTrue(saved.getValue().getTypeName().equals("TULIPS"));
		assertTrue(saved.getValue().getCategoryName().equals("POTTED"));
	}

	@Test
	void updateAnswersNotFoundForAMissingRow() throws Exception {
		when(productRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(put("/api/product/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Tulip\",\"price\":199000}"))
			.andExpect(status().isNotFound());
	}

	@Test
	void deleteRemovesAnExistingRow() throws Exception {
		when(productRepository.findById(2L)).thenReturn(Optional.of(rose()));

		mockMvc.perform(delete("/api/product/2").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNoContent());

		verify(productRepository).deleteById(2L);
	}

	@Test
	void deleteAnswersNotFoundForAMissingRow() throws Exception {
		when(productRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(delete("/api/product/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound());
	}
}
