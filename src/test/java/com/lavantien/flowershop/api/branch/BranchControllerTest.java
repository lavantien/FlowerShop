package com.lavantien.flowershop.api.branch;

import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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

class BranchControllerTest {
	private BranchRepository branchRepository;
	private StockLevelRepository stockLevelRepository;
	private ProductRepository productRepository;
	private UserRepository userRepository;
	private UserService userService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		branchRepository = mock(BranchRepository.class);
		stockLevelRepository = mock(StockLevelRepository.class);
		productRepository = mock(ProductRepository.class);
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(
				new BranchController(branchRepository, stockLevelRepository, productRepository))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
	}

	private static Branch binhThanh() {
		Branch branch = new Branch("Binh Thanh Hub", "01 Dien Bien Phu", "Bình Thạnh", "Hồ Chí Minh",
			10.7980, 106.7105, true);
		branch.setId(3L);
		return branch;
	}

	private static Product product(long id, String name) {
		Product product = new Product(name, "demo", "https://cdn.example/x.jpg", BigDecimal.valueOf(100000),
			"IT-T", "IT-C");
		product.setId(id);
		return product;
	}

	private static StockLevel stockLevel(long branchId, long productId, int quantity) {
		StockLevel row = new StockLevel();
		row.setId(branchId * 1000 + productId);
		row.setBranchId(branchId);
		row.setProductId(productId);
		row.setQuantity(quantity);
		return row;
	}

	@Test
	void anonymousListsBranchesWithoutAToken() throws Exception {
		when(branchRepository.findAll()).thenReturn(List.of(binhThanh()));

		mockMvc.perform(get("/api/branch"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(3))
			.andExpect(jsonPath("$[0].name").value("Binh Thanh Hub"))
			.andExpect(jsonPath("$[0].address").value("01 Dien Bien Phu"))
			.andExpect(jsonPath("$[0].district").value("Bình Thạnh"))
			.andExpect(jsonPath("$[0].city").value("Hồ Chí Minh"))
			.andExpect(jsonPath("$[0].lat").value(10.7980))
			.andExpect(jsonPath("$[0].lng").value(106.7105))
			.andExpect(jsonPath("$[0].active").value(true));
	}

	@Test
	void memberCannotCreateABranch() throws Exception {
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));

		mockMvc.perform(post("/api/branch").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Nope\"}"))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminCreatesABranchDefaultingActiveToTrue() throws Exception {
		when(branchRepository.save(any(Branch.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/branch").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"District 1 Hub\",\"address\":\"01 Nguyen Hue\",\"district\":\"1\","
					+ "\"city\":\"Hồ Chí Minh\",\"lat\":10.7750,\"lng\":106.7035}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("District 1 Hub"))
			.andExpect(jsonPath("$.active").value(true));

		ArgumentCaptor<Branch> saved = ArgumentCaptor.forClass(Branch.class);
		verify(branchRepository).save(saved.capture());
		assertTrue(Boolean.TRUE.equals(saved.getValue().getActive()), "an omitted active must default to true");
		assertTrue(saved.getValue().toString().contains("name='District 1 Hub'"), "toString must render the fields");
	}

	@Test
	void adminCreatesAnExplicitlyInactiveBranch() throws Exception {
		when(branchRepository.save(any(Branch.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/branch").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Closed Hub\",\"active\":false}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false));
	}

	@Test
	void adminCreateRejectsAStringPastTheColumnWidthInsteadOfTruncatingAtTheDatabase() throws Exception {
		mockMvc.perform(post("/api/branch").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"" + "x".repeat(256) + "\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.name").value("size must be between 0 and 255"));

		verify(branchRepository, never()).save(any(Branch.class));
	}

	@Test
	void createRequiresAName() throws Exception {
		mockMvc.perform(post("/api/branch").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.name").value("must not be blank"));
	}

	@Test
	void adminUpdatesABranchKeepingAnOmittedActive() throws Exception {
		when(branchRepository.findById(3L)).thenReturn(Optional.of(binhThanh()));
		when(branchRepository.save(any(Branch.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/branch/3").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Renamed Hub\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Renamed Hub"));

		ArgumentCaptor<Branch> saved = ArgumentCaptor.forClass(Branch.class);
		verify(branchRepository).save(saved.capture());
		assertTrue(Boolean.TRUE.equals(saved.getValue().getActive()), "an omitted active must keep the stored value");
	}

	@Test
	void updateAnswers404ForAMissingBranch() throws Exception {
		when(branchRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(put("/api/branch/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Ghost Hub\"}"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void adminDeletesABranchWithoutStockRows() throws Exception {
		when(branchRepository.findById(3L)).thenReturn(Optional.of(binhThanh()));
		when(stockLevelRepository.existsByBranchId(3L)).thenReturn(false);

		mockMvc.perform(delete("/api/branch/3").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNoContent());

		verify(branchRepository).deleteById(3L);
	}

	@Test
	void deleteRefusesABranchWithStockRows() throws Exception {
		when(branchRepository.findById(3L)).thenReturn(Optional.of(binhThanh()));
		when(stockLevelRepository.existsByBranchId(3L)).thenReturn(true);

		mockMvc.perform(delete("/api/branch/3").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("STOCK_ROWS_EXIST"));

		verify(branchRepository, never()).deleteById(3L);
	}

	@Test
	void deleteAnswers404ForAMissingBranch() throws Exception {
		when(branchRepository.findById(9L)).thenReturn(Optional.empty());

		mockMvc.perform(delete("/api/branch/9").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void branchStockListsEveryProductWithZeroWhenAbsent() throws Exception {
		when(branchRepository.findById(3L)).thenReturn(Optional.of(binhThanh()));
		when(productRepository.findAll()).thenReturn(List.of(product(1, "Rose"), product(2, "Tulip")));
		when(stockLevelRepository.findByBranchId(3L)).thenReturn(List.of(stockLevel(3, 1, 5)));

		mockMvc.perform(get("/api/branch/3/stock").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].productId").value(1))
			.andExpect(jsonPath("$[0].quantity").value(5))
			.andExpect(jsonPath("$[1].productId").value(2))
			.andExpect(jsonPath("$[1].quantity").value(0));
	}

	@Test
	void branchStockAnswers404ForAMissingBranch() throws Exception {
		when(branchRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/branch/99/stock").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound());
		mockMvc.perform(put("/api/branch/99/stock").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"productId\":1,\"quantity\":5}"))
			.andExpect(status().isNotFound());
	}

	@Test
	void branchStockSetIsAbsoluteWithAFloorOfZero() throws Exception {
		when(branchRepository.findById(3L)).thenReturn(Optional.of(binhThanh()));
		when(productRepository.findById(2L)).thenReturn(Optional.of(product(2, "Tulip")));
		StockLevel existing = stockLevel(3, 2, 8);
		when(stockLevelRepository.findByBranchIdAndProductId(3L, 2L)).thenReturn(Optional.of(existing));
		when(stockLevelRepository.save(any(StockLevel.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/branch/3/stock").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"productId\":2,\"quantity\":-5}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.productId").value(2))
			.andExpect(jsonPath("$.quantity").value(0));

		ArgumentCaptor<StockLevel> saved = ArgumentCaptor.forClass(StockLevel.class);
		verify(stockLevelRepository).save(saved.capture());
		assertEquals(0, saved.getValue().getQuantity(), "a negative set must floor to zero");
		assertEquals(3L, saved.getValue().getBranchId());
		assertEquals(2L, saved.getValue().getProductId());
	}

	@Test
	void branchStockSetCreatesARowWhenAbsent() throws Exception {
		when(branchRepository.findById(3L)).thenReturn(Optional.of(binhThanh()));
		when(productRepository.findById(1L)).thenReturn(Optional.of(product(1, "Rose")));
		when(stockLevelRepository.findByBranchIdAndProductId(3L, 1L)).thenReturn(Optional.empty());
		when(stockLevelRepository.save(any(StockLevel.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/branch/3/stock").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"productId\":1,\"quantity\":25}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.quantity").value(25));

		ArgumentCaptor<StockLevel> saved = ArgumentCaptor.forClass(StockLevel.class);
		verify(stockLevelRepository).save(saved.capture());
		assertEquals(25, saved.getValue().getQuantity());
		assertEquals(null, saved.getValue().getId(), "a fresh row must let the database assign the id");
		assertTrue(saved.getValue().toString().contains("branchId=3"), "toString must render the row");
	}

	@Test
	void branchStockSetAnswers404ForAMissingProduct() throws Exception {
		when(branchRepository.findById(3L)).thenReturn(Optional.of(binhThanh()));
		when(productRepository.findById(77L)).thenReturn(Optional.empty());

		mockMvc.perform(put("/api/branch/3/stock").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"productId\":77,\"quantity\":5}"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}
}
