package com.lavantien.flowershop.api.user;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "user", uniqueConstraints = @UniqueConstraint(name = User.EMAIL_UNIQUE_KEY, columnNames = "email"))
public class User {
	public static final String EMAIL_UNIQUE_KEY = "UKob8kqyqqgmefl0aco34akdtpe";

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	private String name;
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String password;
	@Column
	private String email;
	private String phone;
	private String address;
	private String district;
	private String city;
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String answer;
	@Enumerated(EnumType.STRING)
	private Role role = Role.USER;
	private Boolean enable = true;

	public User() {
	}

	public User(String name, String password, String email, String phone, String address, String district, String city, String answer) {
		this.name = name;
		this.password = password;
		this.email = email;
		this.phone = phone;
		this.address = address;
		this.district = district;
		this.city = city;
		this.answer = answer;
	}

	@Override
	public String toString() {
		return "User{" +
			"id=" + id +
			", name='" + name + '\'' +
			", email='" + email + '\'' +
			", phone='" + phone + '\'' +
			", address='" + address + '\'' +
			", district='" + district + '\'' +
			", city='" + city + '\'' +
			", role='" + role + '\'' +
			", enable=" + enable +
			'}';
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getPhone() {
		return phone;
	}

	public void setPhone(String phone) {
		this.phone = phone;
	}

	public String getAddress() {
		return address;
	}

	public void setAddress(String address) {
		this.address = address;
	}

	public String getDistrict() {
		return district;
	}

	public void setDistrict(String district) {
		this.district = district;
	}

	public String getCity() {
		return city;
	}

	public void setCity(String city) {
		this.city = city;
	}

	public Role getRole() {
		return role;
	}

	public void setRole(Role role) {
		this.role = role;
	}

	public Boolean getEnable() {
		return enable;
	}

	public void setEnable(Boolean enable) {
		this.enable = enable;
	}

	public String getAnswer() {
		return answer;
	}

	public void setAnswer(String answer) {
		this.answer = answer;
	}
}
