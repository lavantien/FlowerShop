package com.lavantien.flowershop;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.SpringBootTest;

import static org.mockito.Mockito.mockStatic;

@SpringBootTest
class FlowershopApplicationTests {

	@Test
	void contextLoads() {
	}

	@Test
	void mainDelegatesToSpringApplication() {
		String[] args = {"--server.port=0"};
		try (MockedStatic<SpringApplication> spring = mockStatic(SpringApplication.class)) {
			FlowershopApplication.main(args);
			spring.verify(() -> SpringApplication.run(FlowershopApplication.class, args));
		}
	}
}
