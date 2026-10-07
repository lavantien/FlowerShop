package com.lavantien.flowershop;

import com.lavantien.flowershop.service.ShopProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(ShopProperties.class)
public class FlowershopApplication {

	public static void main(String[] args) {
		SpringApplication.run(FlowershopApplication.class, args);
	}

}
