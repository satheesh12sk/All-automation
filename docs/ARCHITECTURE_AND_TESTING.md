# Architecture and Testing

- Run axes: environment (`config/environments.ts`) × language (`config/language.ts`).
- Tests import `test`/`expect` from `src/fixtures/appTest.ts`, which injects `lang` and `ui(key)`.
- Page objects live in `src/pages/<section>/`; all on-screen text goes through `UiCopy`.
