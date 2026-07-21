# 0010: Device identity, place context, and network evidence

**Status:** Accepted for alpha

## Context

Digital activity has different meaning depending on the device and place where it occurred. An application name such as ChatGPT is not enough to distinguish mobile questions from development work on a laptop. Likewise, laptop activity at an office, at home, or while travelling supports different patterns.

ATIRA also needs useful place context on Windows before continuous phone collectors are available. IP addresses, Wi-Fi access-point identifiers, and local-network client lists can contribute evidence, but none is equivalent to a phone's GPS history.

## Decision

### Use semantic device identity

Every device-scoped observation carries a locally generated stable `deviceId`, device class, platform, user-facing label, collector identity, and provider provenance. Hardware serial numbers and MAC addresses are not ATIRA's primary device identity.

Digital aggregation is device-scoped by default. Cross-device rollups remain possible but explicit. Inference rules may use device class as evidence and must preserve the original observation provenance.

### Join activity to place, do not bake place into app identity

Known-place stays and digital sessions remain normalized interval streams. A deterministic fusion step joins them by timestamp overlap and records coverage, accuracy, and competing evidence. This permits place-aware work patterns without mutating raw activity or assuming that all computer use is work.

### Treat network-derived location according to its actual precision

The Windows companion may collect permissioned operating-system location and a privacy-minimized network fingerprint. A user may label a recurring network context Home, Office, or another known place. IP-derived location remains coarse fallback evidence. Router client presence, if later supported on a user-controlled router, indicates presence on that particular network only.

ATIRA will not claim that a public IP or MAC address passively tracks an uninstrumented phone. A public IP is commonly shared, a MAC address is not globally routed and may be randomized, and neither supplies phone application activity or a journey trace.

## Consequences

Device and place become first-class analytical dimensions before additional collectors arrive. The current Windows-only experience can produce legitimate Home/Office and work-location value, while future phone, Mac, Android, watch, and wearable sources fit the same contract.

Network identifiers are sensitive. Collection must be disclosed, minimized, locally protected, pausable, exportable, and deletable. Inferences must display whether place came from precise coordinates, operating-system fusion, a labelled network, coarse IP, router presence, or another source.

## Technical references

- [Windows location for desktop apps](https://learn.microsoft.com/en-us/windows/apps/develop/maps-and-location/get-location)
- [Windows geolocation source model](https://learn.microsoft.com/en-us/uwp/api/windows.devices.geolocation)
- [Google Geolocation API Wi-Fi and IP behavior](https://developers.google.com/maps/documentation/geolocation/requests-geolocation)
- [Apple private Wi-Fi addresses](https://support.apple.com/en-ie/102509)
- [Android MAC randomization](https://source.android.com/docs/core/connect/wifi-mac-randomization)
- [RFC 6269: issues with IP address sharing](https://www.rfc-editor.org/rfc/rfc6269)
- [iOS background location updates](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)
- [Android background location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions/background)
