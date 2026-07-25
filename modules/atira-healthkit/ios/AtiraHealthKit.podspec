Pod::Spec.new do |s|
  s.name             = 'AtiraHealthKit'
  s.version          = '1.0.0'
  s.summary          = 'Read-only HealthKit ingestion for ATIRA.'
  s.description      = 'Queries a bounded range of consented HealthKit samples without writing health data.'
  s.license          = { :type => 'Proprietary' }
  s.author           = 'ATIRA'
  s.homepage         = 'https://github.com/JohnnyCBueno/ATIRA'
  s.platforms        = { :ios => '16.4' }
  s.source           = { :git => 'https://github.com/JohnnyCBueno/ATIRA.git' }
  s.static_framework = true
  s.source_files     = '**/*.{h,m,swift}'
  s.requires_arc     = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'
end
