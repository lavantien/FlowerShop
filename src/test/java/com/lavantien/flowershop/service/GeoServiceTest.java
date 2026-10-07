package com.lavantien.flowershop.service;

import com.lavantien.flowershop.api.branch.Branch;
import org.junit.jupiter.api.Test;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GeoServiceTest {
	private static final ShopProperties PROPERTIES = new ShopProperties(
		new ShopProperties.Delivery(20000, 5000, 200000, 1000),
		new ShopProperties.Payment("dev-only-secret", "/pay"));

	private final GeoService geoService = new GeoService(PROPERTIES);

	private static Branch branch(long id, Double lat, Double lng, boolean active) {
		Branch branch = new Branch("Branch " + id, "01 Demo Street", "1", "Hồ Chí Minh", lat, lng, active);
		branch.setId(id);
		return branch;
	}

	@Test
	void resolvePrefersDistrictThenCityThenDefault() {
		GeoService.Point binhThanh = geoService.resolve("Bình Thạnh", "Hà Nội");
		assertEquals(10.7980, binhThanh.lat(), 1e-9);
		assertEquals(106.7105, binhThanh.lng(), 1e-9);

		GeoService.Point haNoi = geoService.resolve("Nowhere", "Hà Nội");
		assertEquals(21.0285, haNoi.lat(), 1e-9);

		GeoService.Point fallback = geoService.resolve("Nowhere", "Elsewhere");
		assertEquals(new GeoService.Point(10.7769, 106.7009), fallback);
		assertEquals(fallback, geoService.resolve(null, null));
		assertEquals(fallback, geoService.resolve("", ""));
	}

	@Test
	void theDatasetMatchesTheFrontendGeoAssetsExactly() throws IOException {
		// The frontend ships districts.json and cities.json; the server must
		// resolve the same names, diacritics included, or checkout falls back.
		ObjectMapper mapper = new ObjectMapper();
		List<Map<String, String>> districtRows = mapper.readValue(
			Path.of("frontend/src/assets/data/districts.json").toFile(),
			new TypeReference<List<Map<String, String>>>() {});
		List<Map<String, String>> cityRows = mapper.readValue(
			Path.of("frontend/src/assets/data/cities.json").toFile(),
			new TypeReference<List<Map<String, String>>>() {});

		Set<String> districtNames = new HashSet<>();
		districtRows.forEach(row -> districtNames.add(row.get("name")));
		Set<String> cityNames = new HashSet<>();
		cityRows.forEach(row -> cityNames.add(row.get("name")));

		assertEquals(28, districtNames.size());
		assertEquals(6, cityNames.size());
		assertEquals(districtNames, Set.copyOf(geoService.knownDistricts()));
		assertEquals(cityNames, Set.copyOf(geoService.knownCities()));
	}

	@Test
	void distanceRoundsUpToTheTenthOfAKilometer() {
		assertEquals(0.0, geoService.distanceKm(new GeoService.Point(0, 0), new GeoService.Point(0, 0)));
		// One degree on the equator is 111.196 km with R = 6371.0088.
		assertEquals(111.2, geoService.distanceKm(new GeoService.Point(0, 0), new GeoService.Point(0, 1)));
		assertEquals(15.7, geoService.distanceKm(new GeoService.Point(10, 10), new GeoService.Point(10.1, 10.1)));
		assertTrue(geoService.distanceKm(new GeoService.Point(0, 0), new GeoService.Point(0.01, 0)) > 1.0);
	}

	@Test
	void deliveryFeeRoundsHalfUpToTheStepAndCapsAtTheMax() {
		assertEquals(20000, geoService.deliveryFee(0));
		assertEquals(41000, geoService.deliveryFee(4.2));
		assertEquals(41000, geoService.deliveryFee(4.25));
		assertEquals(43000, geoService.deliveryFee(4.5));
		assertEquals(20000, geoService.deliveryFee(0.05));
		assertEquals(200000, geoService.deliveryFee(36));
		assertEquals(200000, geoService.deliveryFee(100));
	}

	@Test
	void nearestBranchPicksTheClosestActiveBranchWithTiesToTheLowestId() {
		GeoService.Point target = new GeoService.Point(10.7769, 106.7009);

		Branch close = branch(5, 10.78, 106.70, true);
		Branch far = branch(2, 10.85, 106.75, true);
		assertEquals(close, geoService.nearestBranch(List.of(far, close), target));

		Branch tieHigh = branch(7, 10.78, 106.70, true);
		Branch tieLow = branch(2, 10.78, 106.70, true);
		assertEquals(tieLow, geoService.nearestBranch(List.of(tieHigh, tieLow), target));

		Branch inactiveNear = branch(1, target.lat(), target.lng(), false);
		Branch activeFar = branch(9, 10.9, 106.9, true);
		assertEquals(activeFar, geoService.nearestBranch(List.of(inactiveNear, activeFar), target));

		Branch coordinateless = branch(1, null, null, true);
		assertEquals(activeFar, geoService.nearestBranch(List.of(coordinateless, activeFar), target));

		assertNull(geoService.nearestBranch(List.of(inactiveNear), target));
		assertNull(geoService.nearestBranch(List.of(), target));
	}

	@Test
	void nearestBranchKeepsTheEarlierTiedBranchWhenAHigherIdArrivesSecond() {
		GeoService.Point target = new GeoService.Point(10.7769, 106.7009);

		Branch tieLow = branch(2, 10.78, 106.70, true);
		Branch tieHigh = branch(7, 10.78, 106.70, true);
		assertEquals(tieLow, geoService.nearestBranch(List.of(tieLow, tieHigh), target));
	}

	@Test
	void nearestBranchPrefersDistanceOverALowerIdOnTheFartherBranch() {
		GeoService.Point target = new GeoService.Point(10.7769, 106.7009);

		Branch close = branch(5, 10.78, 106.70, true);
		Branch far = branch(2, 10.85, 106.75, true);
		assertEquals(close, geoService.nearestBranch(List.of(close, far), target));
	}

	@Test
	void malformedGeoDataFailsFast() {
		var broken = new ByteArrayInputStream("{ not json".getBytes(StandardCharsets.UTF_8));
		assertThrows(IllegalStateException.class, () -> GeoService.parse(broken));
	}

	@Test
	void aMissingResourceFailsFastAtConstruction() {
		assertThrows(IllegalStateException.class, () -> new GeoService("geo/nope.json", PROPERTIES));
	}

	@Test
	void parseReadsTheWireShapeIntoLookups() {
		String json = """
			{
				"default": {"lat": 1.0, "lng": 2.0},
				"cities": [{"name": "City", "lat": 3.0, "lng": 4.0}],
				"districts": [{"name": "District", "cityName": "City", "lat": 5.0, "lng": 6.0}]
			}
			""";
		GeoService.GeoData data = GeoService.parse(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));
		GeoService service = new GeoService(data, PROPERTIES);

		assertEquals(new GeoService.Point(5.0, 6.0), service.resolve("District", null));
		assertEquals(new GeoService.Point(3.0, 4.0), service.resolve("Unknown", "City"));
		assertEquals(new GeoService.Point(1.0, 2.0), service.resolve("Unknown", "Unknown"));
	}
}
