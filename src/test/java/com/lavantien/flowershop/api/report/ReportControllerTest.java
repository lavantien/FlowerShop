package com.lavantien.flowershop.api.report;

import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.order.OrderStatus;
import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.ReportService;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ReportControllerTest {
	private ReportService reportService;
	private UserRepository userRepository;
	private UserService userService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		reportService = mock(ReportService.class);
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(new ReportController(reportService))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
	}

	private static SalesReport sampleReport() {
		Map<OrderStatus, BigDecimal> revenue = new EnumMap<>(OrderStatus.class);
		revenue.put(OrderStatus.PAID, BigDecimal.valueOf(350000));
		Map<OrderStatus, Long> counts = new EnumMap<>(OrderStatus.class);
		counts.put(OrderStatus.PAID, 3L);
		return new SalesReport(new SalesReport.Totals(BigDecimal.valueOf(350000), 3, BigDecimal.valueOf(117000)),
			revenue, counts,
			List.of(new SalesReport.DayRevenue("2026-10-07", BigDecimal.valueOf(350000))),
			List.of(new SalesReport.TopProduct(10L, "Rose", 4, BigDecimal.valueOf(200000))));
	}

	@Test
	void anonymousCannotReadTheSalesReport() throws Exception {
		mockMvc.perform(get("/api/report/sales"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void memberCannotReadTheSalesReport() throws Exception {
		mockMvc.perform(get("/api/report/sales").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminReadsTheSalesReportShape() throws Exception {
		when(reportService.sales(any(), any())).thenReturn(sampleReport());

		mockMvc.perform(get("/api/report/sales").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.totals.revenue").value(350000))
			.andExpect(jsonPath("$.totals.orders").value(3))
			.andExpect(jsonPath("$.totals.avgOrder").value(117000))
			.andExpect(jsonPath("$.revenueByStatus.PAID").value(350000))
			.andExpect(jsonPath("$.revenueByStatus.PENDING").doesNotExist())
			.andExpect(jsonPath("$.countsByStatus.PAID").value(3))
			.andExpect(jsonPath("$.revenueByDay[0].day").value("2026-10-07"))
			.andExpect(jsonPath("$.revenueByDay[0].revenue").value(350000))
			.andExpect(jsonPath("$.topProducts[0].productId").value(10))
			.andExpect(jsonPath("$.topProducts[0].name").value("Rose"))
			.andExpect(jsonPath("$.topProducts[0].quantity").value(4))
			.andExpect(jsonPath("$.topProducts[0].revenue").value(200000));
	}

	@Test
	void explicitDatesPassStraightThrough() throws Exception {
		when(reportService.sales(any(), any())).thenReturn(sampleReport());

		mockMvc.perform(get("/api/report/sales")
				.param("from", "2026-09-01").param("to", "2026-09-30")
				.header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		ArgumentCaptor<LocalDate> from = ArgumentCaptor.forClass(LocalDate.class);
		ArgumentCaptor<LocalDate> to = ArgumentCaptor.forClass(LocalDate.class);
		verify(reportService).sales(from.capture(), to.capture());
		assertEquals(LocalDate.of(2026, 9, 1), from.getValue());
		assertEquals(LocalDate.of(2026, 9, 30), to.getValue());
	}

	@Test
	void absentDatesFallBackToTheLast30DaysEndingToday() throws Exception {
		when(reportService.sales(any(), any())).thenReturn(sampleReport());

		mockMvc.perform(get("/api/report/sales").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		ArgumentCaptor<LocalDate> from = ArgumentCaptor.forClass(LocalDate.class);
		ArgumentCaptor<LocalDate> to = ArgumentCaptor.forClass(LocalDate.class);
		verify(reportService).sales(from.capture(), to.capture());
		LocalDate today = LocalDate.now(java.time.ZoneOffset.UTC);
		assertEquals(today, to.getValue());
		assertEquals(today.minusDays(30), from.getValue());
	}

	@Test
	void garbageDatesFallBackLikeAbsentOnes() throws Exception {
		when(reportService.sales(any(), any())).thenReturn(sampleReport());

		mockMvc.perform(get("/api/report/sales")
				.param("from", "not-a-date").param("to", "2026-10-07")
				.header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk());

		ArgumentCaptor<LocalDate> from = ArgumentCaptor.forClass(LocalDate.class);
		ArgumentCaptor<LocalDate> to = ArgumentCaptor.forClass(LocalDate.class);
		verify(reportService).sales(from.capture(), to.capture());
		assertEquals(LocalDate.of(2026, 10, 7), to.getValue());
		assertEquals(LocalDate.of(2026, 9, 7), from.getValue(), "garbage falls back to 30 days before to");
	}
}
