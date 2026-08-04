# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Uses the vocabulary in [SKILL.md](SKILL.md): **module**, **interface**, **seam**, and **adapter**.

## Dependency categories

When assessing a candidate for deepening, classify its dependencies. The category determines how the deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable: merge the modules and test through the new interface directly. No adapter is needed.

### 2. Local-substitutable

Dependencies with local test stand-ins, such as PGLite for Postgres or an in-memory filesystem. Deepenable when the stand-in exists. Test the deepened module with the stand-in running in the test suite. The seam stays internal; do not expose a port at the module's external interface.

### 3. Remote but owned (Ports & Adapters)

Services you own across a network boundary, such as internal APIs or microservices. Define a **port** (interface) at the seam. The deep module owns the logic; inject the transport as an **adapter**. Tests use an in-memory adapter. Production uses an HTTP, gRPC, or queue adapter.

Recommendation shape: *"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it is deployed across a network."*

### 4. True external (Mock)

Third-party services you do not control, such as Stripe or Twilio. The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

## Seam discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Do not introduce a port unless at least two adapters are justified, typically production plus test. A single-adapter seam is just indirection.
- **Internal seams vs external seams.** A deep module can have internal seams, private to its implementation and used by its own tests, as well as the external seam at its interface. Do not expose internal seams through the interface merely because tests use them.

## Testing strategy: replace, don't layer

- Delete old unit tests on shallow modules once tests at the deepened module's interface cover their behaviour.
- Write new tests at the deepened module's interface. The **interface is the test surface**.
- Assert observable outcomes through the interface, not internal state.
- Tests should survive internal refactors. If a test must change when only the implementation changes, it is testing past the interface.
