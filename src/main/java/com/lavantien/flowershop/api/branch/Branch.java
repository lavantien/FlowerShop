package com.lavantien.flowershop.api.branch;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class Branch {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	private String name;
	private String address;
	private String district;
	private String city;
	private Double lat;
	private Double lng;
	private Boolean active = true;

	public Branch() {
	}

	public Branch(String name, String address, String district, String city, Double lat, Double lng, Boolean active) {
		this.name = name;
		this.address = address;
		this.district = district;
		this.city = city;
		this.lat = lat;
		this.lng = lng;
		this.active = active;
	}

	@Override
	public String toString() {
		return "Branch{" +
			"id=" + id +
			", name='" + name + '\'' +
			", address='" + address + '\'' +
			", district='" + district + '\'' +
			", city='" + city + '\'' +
			", lat=" + lat +
			", lng=" + lng +
			", active=" + active +
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

	public Double getLat() {
		return lat;
	}

	public void setLat(Double lat) {
		this.lat = lat;
	}

	public Double getLng() {
		return lng;
	}

	public void setLng(Double lng) {
		this.lng = lng;
	}

	public Boolean getActive() {
		return active;
	}

	public void setActive(Boolean active) {
		this.active = active;
	}
}
