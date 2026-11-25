Pod::Spec.new do |s|
  s.name           = 'KudaiberdiLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Live Activity продавца: токен для бэкенда и закрытие карточки'
  s.author         = 'KUDAIBERDI'
  s.homepage       = 'https://kudaiberdi.kg'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.swift_version = '5.9'
end
