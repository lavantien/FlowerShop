package com.lavantien.flowershop.api.bill;

import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Collections;
import java.util.List;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BillControllerTest {
	private BillRepository billRepository;
	private UserRepository userRepository;
	private UserService userService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		billRepository = mock(BillRepository.class);
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(new BillController(billRepository))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.build();
		prime(userRepository, userService, persona(1, "ADMIN", "admin@flowershop.example"));
		prime(userRepository, userService, persona(4, "USER", "member@flowershop.example"));
	}

	@Test
	void memberReadsOwnBills() throws Exception {
		Bill bill = new Bill("2026-10-07", 1L, 2L, 10.0, 4L, null, "PENDING", "0900000004", "04 Demo Lane");
		bill.setId(7L);
		when(billRepository.findByUserId(4L)).thenReturn(List.of(bill));

		mockMvc.perform(get("/api/bill/user/4").header("X-Auth-Token", tokenOf(4, "USER")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(7))
			.andExpect(jsonPath("$[0].userId").value(4));
	}

	@Test
	void memberReadsAnEmptyListForOwnAccountWithoutBills() throws Exception {
		when(billRepository.findByUserId(4L)).thenReturn(Collections.emptyList());

		mockMvc.perform(get("/api/bill/user/4").header("X-Auth-Token", tokenOf(4, "USER")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$").isArray())
			.andExpect(jsonPath("$").isEmpty());
	}

	@Test
	void memberCannotReadForeignBills() throws Exception {
		mockMvc.perform(get("/api/bill/user/1").header("X-Auth-Token", tokenOf(4, "USER")))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminReadsAnyUsersBills() throws Exception {
		when(billRepository.findByUserId(4L)).thenReturn(Collections.emptyList());

		mockMvc.perform(get("/api/bill/user/4").header("X-Auth-Token", tokenOf(1, "ADMIN")))
			.andExpect(status().isOk());
	}

	@Test
	void anonymousIsBlockedOnAProtectedRoute() throws Exception {
		mockMvc.perform(get("/api/bill"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void memberCannotListEveryBill() throws Exception {
		mockMvc.perform(get("/api/bill").header("X-Auth-Token", tokenOf(4, "USER")))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminListsEveryBill() throws Exception {
		when(billRepository.findAll()).thenReturn(List.of());

		mockMvc.perform(get("/api/bill").header("X-Auth-Token", tokenOf(1, "ADMIN")))
			.andExpect(status().isOk());
	}

	@Test
	void checkoutStampsTheCallerOntoEveryBill() throws Exception {
		when(billRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/bill").header("X-Auth-Token", tokenOf(4, "USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[{\"placementDate\":\"2026-10-07\",\"productId\":1,\"productQuantity\":2,\"price\":10.0,"
					+ "\"userId\":999,\"status\":\"PENDING\",\"phone\":\"0900000004\"}]"))
			.andExpect(status().isOk());

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<Bill>> saved = ArgumentCaptor.forClass(List.class);
		verify(billRepository).saveAll(saved.capture());
		assertTrue(saved.getValue().get(0).getUserId().equals(4L),
			"the bill must be stamped with the authenticated user, not the client payload");
	}
}
