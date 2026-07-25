const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

module.exports = function withAtiraHealthKit(config) {
  config = withInfoPlist(config, (current) => {
    current.modResults.NSHealthShareUsageDescription =
      'Allow ATIRA to privately read your steps, heart rate, sleep and workouts to reconstruct your timeline on this device.';
    return current;
  });
  config = withEntitlementsPlist(config, (current) => {
    current.modResults['com.apple.developer.healthkit'] = true;
    return current;
  });
  return config;
};
