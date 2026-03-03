# R3/NATIVE — Licensing

## Proprietary Software License

Copyright © 2026 Ernesto / R3VIBE. All Rights Reserved.

R3/NATIVE, including all source code, design assets, documentation, and associated materials (collectively, "the Software"), is proprietary software. Unauthorized copying, modification, distribution, sublicensing, or use of the Software is strictly prohibited.

---

## Ownership

All intellectual property rights in the Software — including but not limited to source code, algorithms, UI/UX designs, audio processing logic, AI mixing systems, database schemas, and documentation — are owned exclusively by the author.

---

## Third-Party Dependencies

R3/NATIVE makes use of open-source third-party packages. These packages retain their original licenses. A summary of license categories used:

| License Type | Usage |
|---|---|
| MIT | Most npm packages (React, Express, Vite, Tailwind, Drizzle, etc.) |
| Apache 2.0 | Selected AWS SDK, tooling packages |
| BSD | Some utility packages |
| ISC | Various smaller utilities |

All third-party dependencies are managed via `package.json` and `package-lock.json`. No GPL-licensed packages are included as core runtime dependencies.

**Buyer Note:** A full SBOM (Software Bill of Materials) can be generated via `npm license-checker` or `npm audit` upon request.

---

## Audio Content

Any audio samples, presets, or demo content included in the `uploads/` directory are either:
- Created by the author (fully owned, transferable), or
- Royalty-free / CC0 licensed content

No copyrighted third-party audio is bundled with the platform.

---

## Stripe & AWS Usage

The platform integrates with Stripe (payment processing) and AWS S3 (file storage). These are third-party services governed by their own Terms of Service. The buyer will need to establish their own Stripe and AWS accounts and update the relevant API credentials.

---

## Transfer of Ownership

Upon a completed acquisition:
- Full source code ownership transfers to the buyer
- The seller retains no license to use, copy, or distribute the Software
- The buyer assumes full responsibility for all licensing obligations to third-party package authors
- Brand name "R3/NATIVE" and associated visual identity transfer with the codebase

---

## No Warranty

The Software is provided as-is. The seller makes no warranties, express or implied, including without limitation warranties of merchantability or fitness for a particular purpose.

---

## Contact

For licensing inquiries or acquisition discussions:
**Ernesto / R3VIBE**

---

*Last updated: February 2026*
