import CoreLocation
import ExpoModulesCore
import MapKit

private struct AtiraPlaceSearchOptions: Record {
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0
  @Field var radiusMetres: Double = 180
}

public final class AtiraPlaceSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AtiraPlaceSearch")

    AsyncFunction("searchNearby") { (options: AtiraPlaceSearchOptions) -> [[String: Any]] in
      guard CLLocationCoordinate2DIsValid(
        CLLocationCoordinate2D(latitude: options.latitude, longitude: options.longitude)
      ) else {
        throw InvalidPlaceSearchCoordinateException()
      }

      let centre = CLLocationCoordinate2D(
        latitude: options.latitude,
        longitude: options.longitude
      )
      let radius = min(max(options.radiusMetres, 25), 500)
      let request = MKLocalPointsOfInterestRequest(center: centre, radius: radius)
      request.pointOfInterestFilter = .includingAll

      let response = try await MKLocalSearch(request: request).start()
      return response.mapItems.map { item in
        var candidate: [String: Any] = [
          "name": item.name ?? "Unnamed place",
          "latitude": item.placemark.coordinate.latitude,
          "longitude": item.placemark.coordinate.longitude
        ]
        if let category = item.pointOfInterestCategory?.rawValue {
          candidate["category"] = category
        }
        if let street = item.placemark.thoroughfare {
          candidate["street"] = street
        }
        if let locality = item.placemark.locality {
          candidate["locality"] = locality
        }
        return candidate
      }
    }
  }
}

private final class InvalidPlaceSearchCoordinateException: Exception {
  override var reason: String {
    "ATIRA cannot search Apple Maps with an invalid stay centre."
  }
}
