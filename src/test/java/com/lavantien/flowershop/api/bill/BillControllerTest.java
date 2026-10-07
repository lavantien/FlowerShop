package com.lavantien.flowershop.api.bill;

import com.lavantien.flowershop.api.error.ApiExceptionHandler;
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

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
	}

	@Test
	void memberReadsOwnBills() throws Exception {
		Bill bill = new Bill("2026-10-07", 1L, 2L, 10.0, 4L, null, "PENDING", "0900000004", "04 Demo Lane");
		bill.setId(7L);
		when(billRepository.findByUserId(4L)).thenReturn(List.of(bill));

		mockMvc.perform(get("/api/bill/user/4").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(7))
			.andExpect(jsonPath("$[0].userId").value(4));
	}

	@Test
	void memberReadsAnEmptyListForOwnAccountWithoutBills() throws Exception {
		when(billRepository.findByUserId(4L)).thenReturn(Collections.emptyList());

		mockMvc.perform(get("/api/bill/user/4").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$").isArray())
			.andExpect(jsonPath("$").isEmpty());
	}

	@Test
	void memberCannotReadForeignBills() throws Exception {
		mockMvc.perform(get("/api/bill/user/1").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminReadsAnyUsersBills() throws Exception {
		when(billRepository.findByUserId(4L)).thenReturn(Collections.emptyList());

		mockMvc.perform(get("/api/bill/user/4").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());
	}

	@Test
	void anonymousIsBlockedOnAProtectedRoute() throws Exception {
		mockMvc.perform(get("/api/bill"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void memberCannotListEveryBill() throws Exception {
		mockMvc.perform(get("/api/bill").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminListsEveryBill() throws Exception {
		when(billRepository.findAll()).thenReturn(List.of());

		mockMvc.perform(get("/api/bill").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());
	}

	@Test
	void checkoutStampsTheCallerOntoEveryBill() throws Exception {
		when(billRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/bill").header("X-Auth-Token", tokenOf(4, Role.USER))
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

	@Test
	void adminReadsABillByIdWithEveryField() throws Exception {
		Bill bill = new Bill();
		bill.setId(7L);
		bill.setPlacementDate("2026-10-07");
		bill.setProductId(1L);
		bill.setProductQuantity(2L);
		bill.setPrice(10.0);
		bill.setUserId(4L);
		bill.setSettlementDate("2026-10-09");
		bill.setStatus("SETTLED");
		bill.setPhone("0900000004");
		bill.setDetailAddress("04 Demo Lane");
		when(billRepository.findById(7L)).thenReturn(Optional.of(bill));

		mockMvc.perform(get("/api/bill/7").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(7))
			.andExpect(jsonPath("$.placementDate").value("2026-10-07"))
			.andExpect(jsonPath("$.productId").value(1))
			.andExpect(jsonPath("$.productQuantity").value(2))
			.andExpect(jsonPath("$.price").value(10.0))
			.andExpect(jsonPath("$.settlementDate").value("2026-10-09"))
			.andExpect(jsonPath("$.status").value("SETTLED"))
			.andExpect(jsonPath("$.userId").value(4))
			.andExpect(jsonPath("$.phone").value("0900000004"))
			.andExpect(jsonPath("$.detailAddress").value("04 Demo Lane"));
	}

	@Test
	void missingBillAnswersNotFound() throws Exception {
		when(billRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/bill/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void adminUpdatesABill() throws Exception {
		Bill bill = new Bill("2026-10-07", 1L, 2L, 10.0, 4L, null, "PENDING", "0900000004", "04 Demo Lane");
		bill.setId(7L);
		when(billRepository.findById(7L)).thenReturn(Optional.of(bill));
		when(billRepository.save(any(Bill.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/bill/7").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"id\":7,\"placementDate\":\"2026-10-07\",\"productId\":1,\"productQuantity\":3,\"price\":15.0,"
					+ "\"userId\":4,\"settlementDate\":\"2026-10-09\",\"status\":\"SETTLED\","
					+ "\"phone\":\"0900000004\",\"detailAddress\":\"05 Demo Lane\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("SETTLED"));

		ArgumentCaptor<Bill> saved = ArgumentCaptor.forClass(Bill.class);
		verify(billRepository).save(saved.capture());
		assertTrue(saved.getValue().getStatus().equals("SETTLED"));
		assertTrue(saved.getValue().getProductQuantity().equals(3L));
		assertTrue(saved.getValue().getSettlementDate().equals("2026-10-09"));
		assertTrue(saved.getValue().getDetailAddress().equals("05 Demo Lane"));
		assertTrue(saved.getValue().toString().contains("status='SETTLED'"), "toString must render the persisted fields");
	}

	@Test
	void updateAnswersNotFoundForAMissingBill() throws Exception {
		when(billRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(put("/api/bill/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"SETTLED\"}"))
			.andExpect(status().isNotFound());
	}

	@Test
	void adminDeletesABill() throws Exception {
		Bill bill = new Bill("2026-10-07", 1L, 2L, 10.0, 4L, null, "PENDING", "0900000004", "04 Demo Lane");
		bill.setId(7L);
		when(billRepository.findById(7L)).thenReturn(Optional.of(bill));

		mockMvc.perform(delete("/api/bill/7").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		verify(billRepository).deleteById(7L);
	}

	@Test
	void deleteAnswersNotFoundForAMissingBill() throws Exception {
		when(billRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(delete("/api/bill/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound());
	}

	@Test
	void deleteManyWithoutABodyClearsTheArchive() throws Exception {
		mockMvc.perform(delete("/api/bill").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		verify(billRepository).deleteAll();
	}

	@Test
	void deleteManyWithIdsDeletesOnlyThoseBills() throws Exception {
		Bill bill = new Bill("2026-10-07", 1L, 2L, 10.0, 4L, null, "PENDING", "0900000004", "04 Demo Lane");
		bill.setId(7L);
		when(billRepository.findAllById(List.of(7L))).thenReturn(List.of(bill));

		mockMvc.perform(delete("/api/bill").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("[7]"))
			.andExpect(status().isOk());

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<Bill>> deleted = ArgumentCaptor.forClass(List.class);
		verify(billRepository).deleteAll(deleted.capture());
		assertTrue(deleted.getValue().get(0).getId().equals(7L));
	}
}
