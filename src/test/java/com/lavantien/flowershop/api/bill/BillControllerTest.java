package com.lavantien.flowershop.api.bill;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Collections;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BillControllerTest {
	private BillRepository billRepository;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		billRepository = mock(BillRepository.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new BillController(billRepository)).build();
	}

	@Test
	void getByUserIdReturnsTheBills() throws Exception {
		Bill bill = new Bill("2026-10-07", 1L, 2L, 10.0, 4L, null, "PENDING", "0900000004", "04 Demo Lane");
		bill.setId(7L);
		when(billRepository.findByUserId(4L)).thenReturn(List.of(bill));

		mockMvc.perform(get("/api/bill/user/4"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(7))
			.andExpect(jsonPath("$[0].userId").value(4));
	}

	@Test
	void getByUserIdReturnsAnEmptyListForAUserWithoutBills() throws Exception {
		when(billRepository.findByUserId(4L)).thenReturn(Collections.emptyList());

		mockMvc.perform(get("/api/bill/user/4"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$").isArray())
			.andExpect(jsonPath("$").isEmpty());
	}
}
