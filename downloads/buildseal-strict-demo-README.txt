BuildSeal — local strict verification
Record: seal_1792932046613_1cbf006ecbab
Service lookup:
https://buildseal.io/verify?id=seal_1792932046613_1cbf006ecbab

VERIFIERS
This bundle uses isc_pack_v5_bin for BuildSeal hosted 5.1 packages.
It is separate from isc_verify v0.2.0.
Compatibility with the v0.2.0 demo profile is not established.

TRUST
Public key:
07bef2a88534eddfed032a4d06de927af771affe8975c98c21256a7855bdc03e
Public-key SHA-256 fingerprint:
a5ec97589519d9eea3c6985330f601eadcc6f261234636badb0137039bd0a595

The operator cross-checked this key against production configuration.
You choose whether to trust it. A key inside a package cannot authenticate itself.
The included TSA CA certificate defines the timestamp trust anchor.
Publication on multiple operator-controlled channels is not independent
certification of the operator's identity.

PREBUILT LINUX / WSL
The supplied binary is for x86-64 GNU/Linux.
Required GLIBC symbol versions reach 2.39.
It links to OpenSSL 3 libraries, including libcrypto.so.3.
The openssl command must also be available.
Tested with OpenSSL 3.0.13; the minimum compatible version was not established.
Other libraries and the Linux loader must also be compatible.

Before extracting this archive, verify its SHA-256 against the value
published on the website and in the source repository.
After extraction:
  sha256sum -c SHA256SUMS

Inspect verify.sh before running it, or invoke the verifier directly:
  ./isc_pack_v5_bin --verify pack.json --content content.json --trusted-key 07bef2a88534eddfed032a4d06de927af771affe8975c98c21256a7855bdc03e --strict

BUILD FROM SOURCE — LINUX / macOS
The supplied executable is unnecessary if you build from source.
Rust/Cargo and the openssl command must be installed.
Extract and inspect verifier-source.tar.gz, including Cargo.toml and Cargo.lock.
Then:
  tar -xzf verifier-source.tar.gz
  cargo build --release --locked --manifest-path isc_pack_v5/Cargo.toml
  mkdir -p isc_pack_v5/target/release/trust
  cp trust/freetsa-root.pem isc_pack_v5/target/release/trust/freetsa-root.pem
  ./isc_pack_v5/target/release/isc_pack_v5 --verify pack.json --content content.json --trusted-key 07bef2a88534eddfed032a4d06de927af771affe8975c98c21256a7855bdc03e --strict

The source build was tested on Linux with Rust/Cargo 1.94.1.
macOS instructions are untested. Platform build dependencies may be needed.
No reproducible-build equivalence claim is made.

WINDOWS
The tested route is WSL with a compatible Linux environment.
Native Windows compilation is untested.
A native build uses Cargo and produces isc_pack_v5.exe.
It also requires an openssl executable on PATH and the CA certificate at:
  <directory-containing-exe>/trust/freetsa-root.pem
Do not expect the supplied Linux binary to run as a native Windows executable.

SCOPE
Strict verification checks content matching, package integrity, signature,
the explicitly trusted signing key, and RFC3161 timestamp verification
against the supplied CA trust store and timestamp request.
It does not establish decision correctness, independently certified signer
identity, legal qualification, revocation status or record-chain validity.

This is fictional demo content processed by BuildSeal's server.
Local verification does not demonstrate server-blind encryption.
Checksums published by the same operator do not independently authenticate
the download. Inspect source and build inputs before building or executing.
example-verification.txt is captured output; rerun verification yourself.
