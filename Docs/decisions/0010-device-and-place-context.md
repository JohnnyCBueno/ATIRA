# 0010: Device identity, place context, and dedicated collectors

**Status:** Accepted for alpha

## Context

Digital activity has different meaning depending on the device and place where it occurred. An application name such as ChatGPT is not enough to distinguish mobile questions from development work on a laptop. Likewise, laptop activity at an office, at home, or while travelling supports different patterns.

ATIRA ultimately needs place context, but IP addresses, Wi-Fi client identifiers, and local-network client lists cannot deliver the continuous phone route central to the product promise.

## Decision

### Use semantic device identity

Every device-scoped observation carries a locally generated stable `deviceId`, device class, platform, user-facing label, collector identity, and provider provenance. Hardware serial numbers and MAC addresses are not ATIRA's primary device identity.

Digital aggregation is device-scoped by default. Cross-device rollups remain possible but explicit. Inference rules may use device class as evidence and must preserve the original observation provenance.

### Join activity to place, do not bake place into app identity

Known-place stays and digital sessions remain normalized interval streams. A deterministic fusion step joins them by timestamp overlap and records coverage, accuracy, and competing evidence. This permits place-aware work patterns without mutating raw activity or assuming that all computer use is work.

### Require a dedicated collector for real location

ATIRA will not implement public-IP, MAC-address, or router-presence tracking as a phone-location workaround. Real location comes from a dedicated, permissioned collector running on the device being located. Until that collector can be built and tested on hardware, the product reports location as unavailable rather than substituting low-quality evidence.

## Consequences

Device and place remain first-class analytical dimensions before additional collectors arrive. The current Windows-only experience produces device-scoped digital value, while future phone, Mac, Android, watch, and wearable sources fit the same contract.

Inferences must display which dedicated collector supplied place, its precision and coverage, and which periods remain unknown.

## Technical references

- [Windows location for desktop apps](https://learn.microsoft.com/en-us/windows/apps/develop/maps-and-location/get-location)
- [Windows geolocation source model](https://learn.microsoft.com/en-us/uwp/api/windows.devices.geolocation)
- [Google Geolocation API Wi-Fi and IP behavior](https://developers.google.com/maps/documentation/geolocation/requests-geolocation)
- [Apple private Wi-Fi addresses](https://support.apple.com/en-ie/102509)
- [Android MAC randomization](https://source.android.com/docs/core/connect/wifi-mac-randomization)
- [RFC 6269: issues with IP address sharing](https://www.rfc-editor.org/rfc/rfc6269)
- [iOS background location updates](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)
- [Android background location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions/background)
