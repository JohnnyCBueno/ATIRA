Pod::Spec.new do |s|
  s.name             = 'AtiraPlaceSearch'
  s.version          = '1.0.0'
  s.summary          = 'Nearby Apple MapKit place candidates for ATIRA.'
  s.description      = 'Queries Apple MapKit around reconstructed stay centres so ATIRA can reason over multiple possible places.'
  s.license          = { :type => 'Proprietary' }
  s.author           = 'ATIRA'
  s.homepage         = 'https://github.com/JohnnyCBueno/ATIRA'
  s.platforms        = { :ios => '16.4' }
  s.source           = { :git => 'https://github.com/JohnnyCBueno/ATIRA.git' }
  s.static_framework = true
  s.source_files     = '**/*.{h,m,swift}'
  s.requires_arc     = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MapKit', 'CoreLocation'
end
