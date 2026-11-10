Source: Mesh-LLM/mesh-llm commit 5d19ca69403f5d3e46ddb82ce83164495fa88383, crates/mesh-llm-log-store, version 0.78.1.

Purpose: keep the pinned Mesh bridge while moving the bundled SQLite dependency from rusqlite 0.40/libsqlite3-sys 0.38 to the patched rusqlite 0.41/libsqlite3-sys 0.39 pair. The Rust source and tests are copied unchanged. Only Cargo.toml has been adapted to be a standalone path crate and to use the patched SQLite dependency. The upstream LICENSE is retained.

Retire this copy when Mesh-LLM publishes an equivalent update compatible with the pinned bridge and its regression tests pass.
