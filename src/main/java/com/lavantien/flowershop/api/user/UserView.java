package com.lavantien.flowershop.api.user;

public record UserView(Long id, String name, String email, String phone, String address, String district,
	String city, Role role, Boolean enable) {

	public static UserView from(User user) {
		return new UserView(user.getId(), user.getName(), user.getEmail(), user.getPhone(), user.getAddress(),
			user.getDistrict(), user.getCity(), user.getRole(), user.getEnable());
	}
}
