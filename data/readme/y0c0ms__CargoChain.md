# CargoChain — Public-Chain Logistics Platform

[![CI](https://github.com/y0c0ms/CargoChain/actions/workflows/ci.yml/badge.svg)](https://github.com/y0c0ms/CargoChain/actions/workflows/ci.yml)

> **Course:** Blockchain & DLT · **Institution:** ISCTE
> **Use Case:** 3 — Transportation (Shipping · Logistics · Airlines · Railways)

A prototype multi-modal cargo-tracking platform built on a **public EVM chain** (Ethereum Sepolia, with local Hardhat for development). Every consignment is deployed as its own on-chain contract via **EIP-1167 minimal proxies**; custody transfers are authorised by the current holder and recorded immutably; every IoT sensor batch is anchored as a **Merkle root** — individual readings can be verified by anyone without storing them on-chain.

---

## Academic Motivation

The architecture is grounded in a **PRISMA systematic review of 33 peer-reviewed papers (2017–2026)** on blockchain applied to transport and pharmaceutical traceability — a domain where the stakes of traceability failures are well-documented (the WHO estimates 1 in 10 medical products in low- and middle-income countries is counterfeit or sub-standard, generating an estimated US$30.5 billion in annual spending on such products (WHO, 2017)). Three EU regulatory instruments define the compliance landscape: the Falsified Medicines Directive (FMD, 2011/62/EU), the EMA GDP Guidelines (2013), and eIDAS 2.0 (Regulation 2024/1183) for portable cross-border digital identities.

The literature evolved in **five distinct waves**, each resolving the limitations of the previous:

| Period | Wave | Focus | Landmark Papers |
|--------|------|-------|-----------------|
| 2017–2018 | 1st — Proof of Concept | Viability; first gas cost measurements | Bocek (2017), Tian (2017) |
| 2019–2021 | 2nd — Complete Systems | End-to-end architectures; IoT + GDP/FMD | Musamih (2021), Uddin/MedLedger (2021) |
| 2022–2023 | 3rd — Efficiency & Regulation | EPCIS 2.0; hybrid off-chain; economic analysis | Li (2022), Gruchmann (2023) |
| 2024 | 4th — Identity & Governance | DIDs/VCs; selective disclosure; 24 governance requirements | Fernández-Iglesias (2024), Flamini (2024), Greiner (2024) |
| 2025–2026 | 5th — Integration & Failures | TradeLens lessons; IoT identity; governance is the dominant failure mode | Najati (2025), Hanisch (2026), Ramírez-Gordillo (2025) |

**The pattern across all five waves is consistent:** each wave resolves the central problem of the previous but exposes a new problem the next wave must address.

### Why a public chain?

Every major permissioned-chain consortium — TradeLens (IBM + Maersk, 300+ orgs), we.trade, Marco Polo, Contour, B3i, ASX CHESS — failed in 2022–2023. Najati (2025) applies Ostrom's commons theory to TradeLens and identifies five structural failure factors. Hanisch et al. (2026) analyse 81 blockchain projects across 25 industries: **governance, not technology, is the dominant failure mode.** CargoChain takes the opposite stance: Ethereum provides public auditability, regulatory verifiability, and neutral infrastructure that no single operator controls — directly addressing the primary failure mode of the prior decade.

The full analysis of 16 industry deployments is in [docs/CASE_STUDIES.md](docs/CASE_STUDIES.md).

---

## Design Decisions — Academic Provenance

Every architectural choice in CargoChain is traceable to peer-reviewed evidence from the SOTA review.

| Component | Decision | Academic Basis |
|-----------|----------|----------------|
| **Package.sol** — current-holder custody | `transferCustody()` only moves ownership; `markDelivered()` is also restricted to the current holder | Musamih et al. (2021, 270+ citations): an on-chain custody-transfer state machine for liability tracking |
| **PackageFactory.sol** — EIP-1167 clones | One contract address per shipment, spawned gas-efficiently (~45k gas/clone); factory validates clone authenticity | Address-level isolation replaces single-mapping registries; eliminates cross-shipment state pollution |
| **MerkleIoT.sol** — Merkle batching | N IoT readings → one 32-byte Merkle root on-chain; individual readings provable off-chain with O(log N) proofs | Our own hardhat-gas-reporter benchmark: **67.7% gas reduction** vs. the best on-chain baseline; Bocek (2017) identified the cost problem in 2017 |
| **Hybrid off-chain storage** | `docsHash` + `docsURI` on-chain; cargo JSON off-chain (IPFS/HTTPS) | Li et al. (2022): EPCIS 2.0 as canonical off-chain model; GDPR compliance by construction (personal data never immutably on-chain) |
| **Oracle allowlist** | `approvedOracle` mapping; only whitelisted addresses can call `anchorBatch()` | Sarkar (2023), Zeng (2024): unauthenticated sensors are the primary attack vector — anyone can inject false readings without access control |
| **State machine** | `Created → InTransit → Delivered / Disputed` in `Package.sol` | Musamih (2021): on-chain state machine for custody transfers; Haq & Muselemu Esuka (2018): GDP/FMD require verifiable handover records |
| **Platform choice** | Ethereum Sepolia (prototyping); roadmap to Hyperledger Fabric + Ethereum L1 anchors | Duman & Aydoğan (2025): Fabric 442–818 TPS in queries, deterministic finality vs. Ethereum ~15 TPS; Musamih (2021): Ethereum + IPFS off-chain reference model |

---

## Six Research Gaps — SOTA Position

The PRISMA review of 33 papers identifies six gaps that no existing paper resolves simultaneously. CargoChain's response to each:

| Gap | Absence in the Literature | CargoChain Response |
|-----|--------------------------|---------------------|
| **G1 — DIDs/VCs absent in traceability** | All 15 primary corpus papers use centralised identity (PKI / Fabric CA). Zero papers implement DIDs in cargo tracking. | *Future extension:* DID registry + carrier VC lifecycle (W3C DID Core 1.0 + VC Data Model 2.0) |
| **G2 — IoT scalability** | Bocek (2017): on-chain IoT storage prohibitively expensive. Coldnet (2025): ~$0.15/batch in Ethereum L1. | `MerkleIoT.sol`: Merkle batching — 67.7% gas reduction in our own benchmark vs. the best on-chain baseline. IOTA zero-fee as future extension. |
| **G3 — Neutral governance** | TradeLens shut down 2022. Governance is the dominant failure mode (Hanisch, 2026). | PharmaLedger governance model (neutral operator); satisfies 5/24 Greiner technical requirements; 19 organisational requirements are explicit future work |
| **G4 — GDP/FMD/eIDAS alignment** | Haq (2018): GDP+FMD but no IoT. Fernández-Iglesias (2024): GDP+IoT but no DIDs. No paper combines all three. | `Package.sol` covers GDP custody trail. VC layer for eIDAS 2.0 is planned as a future extension. |
| **G5 — EPCIS 2.0 canonical model** | Li (2022): EPCIS 2.0 + Fabric but no DIDs. No paper combines EPCIS 2.0 + DIDs + Merkle IoT. | `docsURI` points to EPCIS 2.0-compatible JSON; SHA-256 `docsHash` anchored on-chain |
| **G6 — VC revocation in IoT** | None of the 33 papers implements VC revocation for IoT devices. EVOKE (Mazzocca, 2024) demonstrates the solution but not in a transport context. | Identified as highest-priority future extension (ECC accumulator-based revocation) |

---

## Technology Readiness (TRL)

| Component | TRL | Status | Evidence |
|-----------|-----|--------|----------|
| Blockchain supply chain traceability | TRL 7–8 | Production-ready | MedLedger (2021), PharmaLedger (2022, 18 members) |
| IoT + blockchain (cold chain) | TRL 5–6 | Demonstrated in relevant environment | Coldnet/Vilas Boas (2025): real Ethereum Sepolia benchmarks |
| W3C DIDs for human/org actors | TRL 6–7 | Limited production pilots | EBSI in production in EU; eIDAS 2.0 legislated |
| VCs for professional licences (GDP/FMD) | TRL 4–5 | Laboratory validation | No published pharma production case |
| DIDs for IoT devices | TRL 3–4 | Proof of concept | Ramírez-Gordillo (2025): IOTA + Raspberry Pi 4; ~175% CPU during crypto ops |
| Selective disclosure — BBS signatures | TRL 4–5 | Formal technical validation | Flamini et al. (2024, ACM CCS): unlinkability formally proved |
| VC revocation in IoT (EVOKE) | TRL 3–4 | Proof of concept | Mazzocca (2024, USENIX Security): 12.62–499.70 ms on consumer devices |
| Multi-stakeholder consortium governance | TRL 6–7 | PharmaLedger in operation | 18 members, neutrality demonstrated; Hanisch (2026): 81 cases analysed |

---

## Quick Start

```bash
git clone https://github.com/y0c0ms/CargoChain.git
cd CargoChain/prototype && npm install && cd app && npm install && cd ../..
```

**Windows (one-click):**
```powershell
.\demo\windows\start-all.ps1   # opens 4 terminals; app ready in ~25 s on http://localhost:3000
```

**Cross-platform (Git Bash / Linux / macOS):**
```bash
bash ./demo/start-all.sh       # Windows Terminal (4 tabs) or background processes on Linux/macOS
```

**Manual:**
```bash
# Terminal 1 — Hardhat node
cd prototype && npx hardhat node

# Terminal 2 — Deploy + seed
cd prototype && npm run deploy:local && npx hardhat run scripts/seed.ts --network localhost

# Terminal 3 — Next.js app  (http://localhost:3000)
cd prototype/app && npm run dev

# Terminal 4 — IoT oracle simulator
cd prototype && npm run oracle:sim
```

Stop everything: `bash ./demo/stop-all.sh`

Full setup with troubleshooting: **[docs/SETUP.md](docs/SETUP.md)**

---

## Repository Layout

```
CargoChain/
├── README.md
├── demo/
│   ├── start-all.sh / stop-all.sh    ← cross-platform orchestrator (Git Bash)
│   ├── start-node.sh / deploy-seed.sh / start-app.sh / start-oracle.sh
│   └── windows/                      ← PowerShell equivalents
│       ├── README.md
│       ├── start-all.ps1 / stop-all.ps1
│       └── start-node.ps1 / deploy-seed.ps1 / start-app.ps1 / start-oracle.ps1
├── docs/
│   ├── SETUP.md           ← install, deploy, seed, run, test, troubleshoot
│   ├── ARCHITECTURE.md    ← layered diagram + per-contract details
│   ├── SECURITY.md        ← threat model + audit findings + regression tests
│   └── CASE_STUDIES.md   ← 16 deployments: 6 permissioned-chain failures, 8 survivors, 2 academic
└── prototype/
    ├── contracts/
    │   ├── PackageFactory.sol  ← spawns one Package clone per shipment (EIP-1167); validates clone authenticity
    │   ├── Package.sol         ← per-shipment: current-holder custody transfer, UN/LOCODE handover trail, state machine
    │   └── MerkleIoT.sol      ← Merkle-batched IoT anchoring; approved-oracle allowlist; individual-reading proofs
    ├── scripts/
    │   ├── deploy.ts           ← deploys PackageFactory + MerkleIoT; approves oracle
    │   ├── seed.ts             ← creates demo packages, transfers custody, anchors IoT batches
    │   └── oracle-simulator.ts ← batches readings every ~8 samples → anchors Merkle root on-chain
    ├── test/                   ← 25 Hardhat tests (24 functional + 1 gas benchmark)
    ├── app/                    ← Next.js 14; 5 role dashboards + live IoT simulation
    └── hardhat.config.ts
```

---

## Documentation

| Document | What's Inside |
|----------|--------------|
| [docs/SETUP.md](docs/SETUP.md) | Step-by-step dev environment, deploy, seed, test, troubleshoot |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram + per-contract details (PackageFactory + Package + MerkleIoT) |
| [docs/SECURITY.md](docs/SECURITY.md) | Audit findings + regression tests + trust-boundaries diagram |
| [docs/CASE_STUDIES.md](docs/CASE_STUDIES.md) | 16 deployments: 6 permissioned-chain failures, 8 survivors, 2 academic |

---

## Concept-Map Coverage

| Area | Exercised In | Concepts Covered |
|------|-------------|-----------------|
| DLT + Blockchain | Public chain (Ethereum Sepolia) | DLT · Blockchain · Block · Tx · P2P |
| Cryptography | Hashes, Merkle, public-key signing | Hash · Merkle · PKI · Ed25519 · Data integrity |
| Consensus & Finality | PoS (Ethereum) | PoS · Validators · Slashing · Finality · EIP-1559 |
| Smart Contracts | 3 Solidity contracts (OpenZeppelin) | SC Definition · Purpose-driven · Solidity · EIP-1167 |
| State Machines | `Package.sol` status enum | Created → InTransit → Delivered / Disputed |
| SSI | Architecture designed for DID/VC extension | SSI · DIDs · DID Document · VC · VC Lifecycle *(future)* |
| On-/Off-chain Pattern | `docsHash` + `docsURI` on-chain; cargo JSON off-chain | Hash anchoring · EPCIS 2.0 compatible |
| Oracles / IoT | `oracle-simulator.ts` + `MerkleIoT.sol` | Oracle · Merkle proof verification · Oracle allowlist |
---

## Test Summary

```bash
cd prototype && npx hardhat test
# 15 passing
```

| File | Cases | Purpose |
|------|-------|---------|
| `test/PackageFactory.test.ts` | 6 | Create clone, custody transfer, delivery, state isolation between shipments |
| `test/Errors.test.ts` | 5 | Custom-error reverts (NotCurrentHolder, AlreadyDelivered, InvalidRecipient, NotAFactoryPackage) |
| `test/MerkleIoT.test.ts` | 7 | Batch anchoring + single-reading Merkle proof verification |
| `test/E2E.test.ts` | 1 | Full multi-dashboard flow with IoT verification |
| `test/Security.test.ts` | 5 | Audit regressions: H-2 (oracle allowlist), H-3 (Merkle proof integrity) |
| `test/GasBenchmark.test.ts` | 1 | Gas benchmark: MerkleIoT vs naive on-chain baselines |

---

## Future Roadmap

Prioritisation: security criticality → documented technical viability → industrial adoption impact.

| Extension | Horizon | Priority | Literature Basis |
|-----------|---------|----------|-----------------|
| **EVOKE VC revocation for IoT** | 6–12 months | **Critical** | Mazzocca et al. (2024, USENIX Security): 12.62–499.70 ms, ~1.5 KB/device, ~half the storage of the best PKI certificates |
| **DIDs/VCs for carriers** | 12–18 months | High | Flamini et al. (2024, ACM CCS): BBS > SD-JWT for multi-verifier unlinkability; Bećirović Ramić et al. (2024): comparative taxonomy |
| **DIDs for IoT devices** | 12–24 months | High | Ramírez-Gordillo et al. (2025): IOTA + Raspberry Pi 4, zero transaction fees |
| **Full EPCIS 2.0 off-chain** | 6–18 months | Medium | Li et al. (2022): canonical GS1 model; Greiner (2024): open standard as core governance requirement |
| **eIDAS 2.0 / EUDIW integration** | 18–36 months | High | Regulation 2024/1183; EBSI in EU production |
| **Migration to Hyperledger Fabric** | 18–36 months | Medium | Duman & Aydoğan (2025): 442–818 TPS in queries, deterministic finality; Musamih (2021): Ethereum + IPFS off-chain reference architecture |

The highest-priority immediate extension is EVOKE revocation: absent revocation is an operational security vulnerability. If a sensor is compromised or a carrier loses its GDP licence mid-transport, there is no mechanism to invalidate its credentials in real time. EVOKE (USENIX Security 2024) demonstrates sub-second revocation on consumer hardware — the reference implementation exists; the missing piece is integration with cargo traceability.

---

## License

MIT — see `LICENSE` (to be added).
