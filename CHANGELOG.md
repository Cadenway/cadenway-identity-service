# Changelog

## [0.4.0](https://github.com/Cadenway/cadenway-identity-service/compare/v0.3.0...v0.4.0) (2026-11-23)


### Features

* **accounts:** add the security of the account ([#31](https://github.com/Cadenway/cadenway-identity-service/issues/31)) ([79be172](https://github.com/Cadenway/cadenway-identity-service/commit/79be1726f470459d6b8aff796531c319094abdbc))
* **accounts:** add two-step verification and the organization authentication policy ([#32](https://github.com/Cadenway/cadenway-identity-service/issues/32)) ([88d63f4](https://github.com/Cadenway/cadenway-identity-service/commit/88d63f4d40c50398c27d8bb8d3fb0c7a09011f26))
* add the organization context, personal api tokens and the profile update ([#27](https://github.com/Cadenway/cadenway-identity-service/issues/27)) ([d980968](https://github.com/Cadenway/cadenway-identity-service/commit/d980968e7db9a01cf4d3835847070ef9b9259bed))
* **identity:** bind federated sign-in to current membership ([#37](https://github.com/Cadenway/cadenway-identity-service/issues/37)) ([26d4d02](https://github.com/Cadenway/cadenway-identity-service/commit/26d4d02f8b32cf97e25e9245196992e70bda2485))
* **identity:** issue and redeem single-use realtime tickets ([#34](https://github.com/Cadenway/cadenway-identity-service/issues/34)) ([e169b60](https://github.com/Cadenway/cadenway-identity-service/commit/e169b60586bf0d223c2e52a98e95aa577422cc05))
* **identity:** reserve and manage account avatars ([#35](https://github.com/Cadenway/cadenway-identity-service/issues/35)) ([312877a](https://github.com/Cadenway/cadenway-identity-service/commit/312877a9339e33c709ae313eb5f1b066ecb47f21))
* **identity:** resolve current verified activity email recipients ([#36](https://github.com/Cadenway/cadenway-identity-service/issues/36)) ([8fb38fe](https://github.com/Cadenway/cadenway-identity-service/commit/8fb38fe34018fddbe5140c3b1162c03b36a2c12d))


### Bug Fixes

* **accounts:** confirm durable account deletion before erasure ([#40](https://github.com/Cadenway/cadenway-identity-service/issues/40)) ([b864af8](https://github.com/Cadenway/cadenway-identity-service/commit/b864af8ba17c12400d2e544c4f6743e2aa051b67))
* **identity:** retire inactive authentication counters ([#39](https://github.com/Cadenway/cadenway-identity-service/issues/39)) ([10fb5fd](https://github.com/Cadenway/cadenway-identity-service/commit/10fb5fdd6ab538c512798630867b3154f56faeaa))
* **identity:** revoke reset links after a password change ([#38](https://github.com/Cadenway/cadenway-identity-service/issues/38)) ([0b9f265](https://github.com/Cadenway/cadenway-identity-service/commit/0b9f265aac34c8c9c3f9a01816837c1918b0fbb6))
* **memberships:** keep retrying member events for a day and adopt the kit contract codes ([#29](https://github.com/Cadenway/cadenway-identity-service/issues/29)) ([c0b685d](https://github.com/Cadenway/cadenway-identity-service/commit/c0b685d4e5f335d9984357bdf7d0cf125128dbc2))

## [0.3.0](https://github.com/Cadenway/cadenway-identity-service/compare/v0.2.0...v0.3.0) (2026-11-16)


### Features

* add the accounts and sessions of the auth walking skeleton ([#21](https://github.com/Cadenway/cadenway-identity-service/issues/21)) ([5c0d181](https://github.com/Cadenway/cadenway-identity-service/commit/5c0d181cd82477af41321c2270d286b77f571ed9))
* wire messaging and the outbox onto nest-common 0.3.0 ([#19](https://github.com/Cadenway/cadenway-identity-service/issues/19)) ([13571b9](https://github.com/Cadenway/cadenway-identity-service/commit/13571b934f76098cca9edfc6c6618a936dcb34cf))


### Bug Fixes

* **accounts:** bind the sign-up verification to the password of the latest sign-up ([#22](https://github.com/Cadenway/cadenway-identity-service/issues/22)) ([cae53b6](https://github.com/Cadenway/cadenway-identity-service/commit/cae53b6e4ef3fe1ce38aff73fecb519fa2a3f54f))
* **deploy:** keep the migrator url out of the running service ([#23](https://github.com/Cadenway/cadenway-identity-service/issues/23)) ([feca419](https://github.com/Cadenway/cadenway-identity-service/commit/feca419caf9a4b5321257b7dab2a5db9e45b3e1c))

## [0.2.0](https://github.com/Cadenway/cadenway-identity-service/compare/v0.1.0...v0.2.0) (2026-11-15)


### Features

* wire the service onto the published service kit ([#16](https://github.com/Cadenway/cadenway-identity-service/issues/16)) ([dc7f818](https://github.com/Cadenway/cadenway-identity-service/commit/dc7f8189ed3a107feccabcd099afd184f3398d03))

## 0.1.0 (2026-11-12)


### Bug Fixes

* **deploy:** sign the deploy commits with the bot's noreply address ([#3](https://github.com/Cadenway/cadenway-identity-service/issues/3)) ([d2f41d6](https://github.com/Cadenway/cadenway-identity-service/commit/d2f41d61c490ba55978535ff767f53e1ff197620))
