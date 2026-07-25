import ExpoModulesCore
import HealthKit

private struct HealthKitQueryOptions: Record {
  @Field var from: String = ""
  @Field var to: String = ""
  @Field var maximumSamplesPerType: Int = 2_000
}

public final class AtiraHealthKitModule: Module {
  private let healthStore = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("AtiraHealthKit")

    Function("isAvailable") {
      HKHealthStore.isHealthDataAvailable()
    }

    AsyncFunction("authorizationRequestStatus") {
      guard HKHealthStore.isHealthDataAvailable() else {
        return "unknown"
      }
      let status = try await self.healthStore.statusForAuthorizationRequest(
        toShare: [],
        read: self.readTypes()
      )
      switch status {
      case .shouldRequest:
        return "should_request"
      case .unnecessary:
        return "unnecessary"
      case .unknown:
        return "unknown"
      @unknown default:
        return "unknown"
      }
    }

    AsyncFunction("requestReadAuthorization") {
      guard HKHealthStore.isHealthDataAvailable() else {
        throw HealthKitUnavailableException()
      }
      try await self.healthStore.requestAuthorization(
        toShare: [],
        read: self.readTypes()
      )
      return true
    }

    AsyncFunction("queryRecent") { (options: HealthKitQueryOptions) async throws -> [String: Any] in
      guard HKHealthStore.isHealthDataAvailable() else {
        throw HealthKitUnavailableException()
      }
      guard
        let from = ISO8601DateFormatter().date(from: options.from),
        let to = ISO8601DateFormatter().date(from: options.to),
        from < to
      else {
        throw InvalidHealthKitRangeException()
      }

      let maximum = min(max(options.maximumSamplesPerType, 1), 5_000)
      async let steps = self.quantitySamples(
        identifier: .stepCount,
        metric: "steps",
        unit: .count(),
        from: from,
        to: to,
        limit: maximum
      )
      async let heartRate = self.quantitySamples(
        identifier: .heartRate,
        metric: "heart_rate",
        unit: .count().unitDivided(by: .minute()),
        from: from,
        to: to,
        limit: maximum
      )
      async let sleep = self.sleepSamples(from: from, to: to, limit: maximum)
      async let workouts = self.workoutSamples(from: from, to: to, limit: maximum)

      let samples = try await steps + heartRate + sleep + workouts
      return [
        "samples": samples.sorted {
          String(describing: $0["startedAt"] ?? "") < String(describing: $1["startedAt"] ?? "")
        },
        "rangeStart": self.timestamp(from),
        "rangeEnd": self.timestamp(to),
        "maximumSamplesPerType": maximum
      ]
    }
  }

  private func readTypes() -> Set<HKObjectType> {
    var types: Set<HKObjectType> = [HKObjectType.workoutType()]
    if let steps = HKObjectType.quantityType(forIdentifier: .stepCount) {
      types.insert(steps)
    }
    if let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate) {
      types.insert(heartRate)
    }
    if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
      types.insert(sleep)
    }
    return types
  }

  private func quantitySamples(
    identifier: HKQuantityTypeIdentifier,
    metric: String,
    unit: HKUnit,
    from: Date,
    to: Date,
    limit: Int
  ) async throws -> [[String: Any]] {
    guard let type = HKObjectType.quantityType(forIdentifier: identifier) else {
      return []
    }
    let samples = try await query(type: type, from: from, to: to, limit: limit)
    return samples.compactMap { sample in
      guard let quantitySample = sample as? HKQuantitySample else {
        return nil
      }
      var output = self.baseSample(quantitySample, metric: metric)
      output["value"] = quantitySample.quantity.doubleValue(for: unit)
      output["unit"] = unit.unitString
      return output
    }
  }

  private func sleepSamples(
    from: Date,
    to: Date,
    limit: Int
  ) async throws -> [[String: Any]] {
    guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
      return []
    }
    let samples = try await query(type: type, from: from, to: to, limit: limit)
    return samples.compactMap { sample in
      guard let categorySample = sample as? HKCategorySample else {
        return nil
      }
      var output = self.baseSample(categorySample, metric: "sleep_session")
      output["value"] = categorySample.endDate.timeIntervalSince(categorySample.startDate)
      output["unit"] = "s"
      output["category"] = self.sleepCategory(categorySample.value)
      return output
    }
  }

  private func workoutSamples(
    from: Date,
    to: Date,
    limit: Int
  ) async throws -> [[String: Any]] {
    let samples = try await query(
      type: HKObjectType.workoutType(),
      from: from,
      to: to,
      limit: limit
    )
    return samples.compactMap { sample in
      guard let workout = sample as? HKWorkout else {
        return nil
      }
      var output = self.baseSample(workout, metric: "workout")
      output["value"] = workout.duration
      output["unit"] = "s"
      output["category"] = String(workout.workoutActivityType.rawValue)
      return output
    }
  }

  private func query(
    type: HKSampleType,
    from: Date,
    to: Date,
    limit: Int
  ) async throws -> [HKSample] {
    let predicate = HKQuery.predicateForSamples(
      withStart: from,
      end: to,
      options: [.strictStartDate]
    )
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
    return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[HKSample], Error>) in
      let query = HKSampleQuery(
        sampleType: type,
        predicate: predicate,
        limit: limit,
        sortDescriptors: [sort]
      ) { _, samples, error in
        if let error {
          continuation.resume(throwing: error)
          return
        }
        continuation.resume(returning: samples ?? [])
      }
      self.healthStore.execute(query)
    }
  }

  private func baseSample(_ sample: HKSample, metric: String) -> [String: Any] {
    var output: [String: Any] = [
      "id": sample.uuid.uuidString.lowercased(),
      "metric": metric,
      "startedAt": timestamp(sample.startDate),
      "endedAt": timestamp(sample.endDate),
      "sourceName": sample.sourceRevision.source.name,
      "sourceBundleIdentifier": sample.sourceRevision.source.bundleIdentifier
    ]
    if let version = sample.sourceRevision.version {
      output["sourceVersion"] = version
    }
    if let manufacturer = sample.device?.manufacturer {
      output["deviceManufacturer"] = manufacturer
    }
    if let model = sample.device?.model {
      output["deviceModel"] = model
    }
    return output
  }

  private func sleepCategory(_ rawValue: Int) -> String {
    switch rawValue {
    case 0:
      return "in_bed"
    case 1:
      return "asleep_unspecified"
    case 2:
      return "awake"
    case 3:
      return "asleep_core"
    case 4:
      return "asleep_deep"
    case 5:
      return "asleep_rem"
    default:
      return "unknown"
    }
  }

  private func timestamp(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
  }
}

private final class HealthKitUnavailableException: Exception, @unchecked Sendable {
  override var reason: String {
    "HealthKit is unavailable on this device."
  }
}

private final class InvalidHealthKitRangeException: Exception, @unchecked Sendable {
  override var reason: String {
    "ATIRA requires a valid bounded HealthKit query range."
  }
}
