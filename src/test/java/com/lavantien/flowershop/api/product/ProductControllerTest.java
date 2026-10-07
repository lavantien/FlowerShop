package com.lavantien.flowershop.api.product;

import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.ProductService;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
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
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		productRepository = mock(ProductRepository.class);
		UserRepository userRepository = mock(UserRepository.class);
		UserService userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(
				new ProductController(productRepository, new ProductService(productRepository)))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.build();
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
	}

	private static Product rose() {
		Product product = new Product("Rose", "A dozen red roses", "https://cdn.example/rose.jpg",
			12.5, 40L, 3L, "FLOWER", "BOUQUET");
		product.setId(2L);
		return product;
	}

	@Test
	void anonymousBrowsesTheCatalogWithoutAToken() throws Exception {
		when(productRepository.findAll()).thenReturn(List.of(rose()));

		mockMvc.perform(get("/api/product"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(2))
			.andExpect(jsonPath("$[0].name").value("Rose"))
			.andExpect(jsonPath("$[0].description").value("A dozen red roses"))
			.andExpect(jsonPath("$[0].imgUrl").value("https://cdn.example/rose.jpg"))
			.andExpect(jsonPath("$[0].price").value(12.5))
			.andExpect(jsonPath("$[0].quantity").value(40))
			.andExpect(jsonPath("$[0].saleAmount").value(3))
			.andExpect(jsonPath("$[0].typeName").value("FLOWER"))
			.andExpect(jsonPath("$[0].categoryName").value("BOUQUET"));
	}

	@Test
	void productIsFoundById() throws Exception {
		when(productRepository.findById(2L)).thenReturn(Optional.of(rose()));

		mockMvc.perform(get("/api/product/2"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Rose"))
			.andExpect(jsonPath("$.categoryName").value("BOUQUET"));
	}

	@Test
	void everyProductFieldSurvivesTheCatalogRoundTrip() throws Exception {
		Product product = new Product();
		product.setId(6L);
		product.setName("Tulip");
		product.setDescription("Fresh cut");
		product.setImgUrl("https://cdn.example/tulip.jpg");
		product.setPrice(9.0);
		product.setQuantity(25L);
		product.setSaleAmount(1L);
		product.setTypeName("FLOWER");
		product.setCategoryName("POTTED");
		when(productRepository.findAll()).thenReturn(List.of(product));

		mockMvc.perform(get("/api/product"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(6))
			.andExpect(jsonPath("$[0].name").value("Tulip"))
			.andExpect(jsonPath("$[0].description").value("Fresh cut"))
			.andExpect(jsonPath("$[0].imgUrl").value("https://cdn.example/tulip.jpg"))
			.andExpect(jsonPath("$[0].price").value(9.0))
			.andExpect(jsonPath("$[0].quantity").value(25))
			.andExpect(jsonPath("$[0].saleAmount").value(1))
			.andExpect(jsonPath("$[0].typeName").value("FLOWER"))
			.andExpect(jsonPath("$[0].categoryName").value("POTTED"));
	}

	@Test
	void missingProductAnswersBadRequest() throws Exception {
		when(productRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/product/99"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void adminSeedsRowsWithoutAnIdThroughSave() throws Exception {
		when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"name\":\"Rose\",\"price\":12.5,\"quantity\":40}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].name").value("Rose"));

		ArgumentCaptor<Product> saved = ArgumentCaptor.forClass(Product.class);
		verify(productRepository).save(saved.capture());
		assertTrue(saved.getValue().getId() == null, "a row without an id must go through the save merge path");
		assertTrue(saved.getValue().toString().contains("name='Rose'"), "toString must render the persisted fields");
	}

	@Test
	void adminUpsertsAnExplicitExistingIdAsAMerge() throws Exception {
		when(productRepository.existsById(2L)).thenReturn(true);
		when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"id\":2,\"name\":\"Rose\",\"price\":15.0}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].price").value(15.0));

		verify(productRepository).save(any(Product.class));
		verify(productRepository, never()).insertWithId(any(Product.class));
	}

	@Test
	void adminInsertsAnExplicitNewIdNatively() throws Exception {
		when(productRepository.existsById(9L)).thenReturn(false);
		when(productRepository.findById(9L)).thenReturn(Optional.of(rose()));

		mockMvc.perform(post("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"id\":9,\"name\":\"Rose\",\"price\":12.5}]"))
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
				.content("[{\"id\":9,\"name\":\"Rose\",\"price\":12.5}]"))
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
				.content("[{\"id\":2,\"name\":\"Rose\",\"price\":12.5}]"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].name").value("Rose"));

		verify(productRepository).save(any(Product.class));
		verify(productRepository, never()).insertWithId(any(Product.class));
	}

	@Test
	void deleteManyWithoutABodyWipesTheCatalog() throws Exception {
		mockMvc.perform(delete("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		verify(productRepository).deleteAll();
	}

	@Test
	void deleteManyWithIdsDeletesOnlyThoseRows() throws Exception {
		when(productRepository.findAllById(List.of(2L, 3L))).thenReturn(List.of(rose()));

		mockMvc.perform(delete("/api/product").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[2,3]"))
			.andExpect(status().isOk());

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
				.content("{\"name\":\"Rose\",\"price\":12.5,\"quantity\":40}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Rose"))
			.andExpect(jsonPath("$.price").value(12.5));

		ArgumentCaptor<Product> saved = ArgumentCaptor.forClass(Product.class);
		verify(productRepository).save(saved.capture());
		assertTrue(saved.getValue().getName().equals("Rose"), "the created product must reach the repository");
	}

	@Test
	void updateSavesTheSubmittedProductWhenTheRowExists() throws Exception {
		when(productRepository.findById(2L)).thenReturn(Optional.of(rose()));
		when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/product/2").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"id\":2,\"name\":\"Tulip\",\"description\":\"Fresh cut\",\"imgUrl\":\"https://cdn.example/tulip.jpg\","
					+ "\"price\":9.0,\"quantity\":25,\"saleAmount\":1,\"typeName\":\"FLOWER\",\"categoryName\":\"BOUQUET\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Tulip"));

		ArgumentCaptor<Product> saved = ArgumentCaptor.forClass(Product.class);
		verify(productRepository).save(saved.capture());
		assertTrue(saved.getValue().getName().equals("Tulip"));
		assertTrue(saved.getValue().getDescription().equals("Fresh cut"));
		assertTrue(saved.getValue().getImgUrl().equals("https://cdn.example/tulip.jpg"));
		assertTrue(saved.getValue().getQuantity().equals(25L));
		assertTrue(saved.getValue().getSaleAmount().equals(1L));
		assertTrue(saved.getValue().getTypeName().equals("FLOWER"));
		assertTrue(saved.getValue().getCategoryName().equals("BOUQUET"));
	}

	@Test
	void updateAnswersBadRequestForAMissingRow() throws Exception {
		when(productRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(put("/api/product/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Tulip\"}"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void deleteRemovesAnExistingRow() throws Exception {
		when(productRepository.findById(2L)).thenReturn(Optional.of(rose()));

		mockMvc.perform(delete("/api/product/2").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		verify(productRepository).deleteById(2L);
	}

	@Test
	void deleteAnswersBadRequestForAMissingRow() throws Exception {
		when(productRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(delete("/api/product/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isBadRequest());
	}
}
