# X-Talent

X-Talent is a platform that connects mentors and mentees, providing a free resource for users to either find a mentor or become one to share their experiences with others.

## Website

Access the X-Talent testing website here: [X-Talent Testing Website](https://xtalent.vercel.app/)

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 20)
- [pnpm](https://pnpm.io/) (version 9)

### Installation

1. Install Node.js (version 20):
   - Visit [Node.js](https://nodejs.org/) and download the version 20 installer for your operating system.
   - Follow the installation instructions provided for your system.
   - Verify the installation by running:
     ```bash
     node -v
     ```
     You should see the version number `20.x.x`.

2. Install PNPM (version 9.12.3):
   - Run the following command to install PNPM globally:
     ```bash
     npm install -g pnpm@9.12.3
     ```
   - Verify the installation by running:
     ```bash
     pnpm -v
     ```
     You should see the version number `9.12.3`.

3. Clone the repository:

   ```bash
   git clone https://github.com/Xchange-Taiwan/X-Talent-Frontend.git
   ```

4. Navigate to the project directory:

   ```bash
   cd X-Talent_Frontend
   ```

5. Install project dependencies:

   ```bash
   pnpm install
   ```

6. Copy `.env.development.local` to the `X-Talent_Frontend` folder:
   - This file contains secrets and tokens required for development.
   - Please request this file from other developers.

### Troubleshooting

This project pins Node to `20.19.0` (see `.nvmrc`) and enforces it via `.npmrc` (`engine-strict=true`). If your local Node version doesn't match, `pnpm install` will fail.

- **`ERR_PNPM_UNSUPPORTED_ENGINE` / `Unsupported engine`** — Your Node version is outside `>=20 <21`. Switch to Node 20.x:
  - With **nvm**: `nvm install 20.19.0 && nvm use 20.19.0`
  - With **fnm**: `fnm use` (auto-reads `.nvmrc`)
  - With **Volta**: `volta install node@20.19.0`
- **Wrong package manager** — Always use `pnpm`, not `npm` or `yarn`. The lockfile and version enforcement are pnpm-specific.
- **pnpm auto-downloads Node** — `.npmrc` sets `use-node-version=20.19.0`, so pnpm will fetch the correct Node version automatically when running install commands. If this isn't working, make sure your pnpm is `>=9`.
- **Why `20.19.0` and not `20.18.0`?** — Node `20.19.0` was the first 20.x release where `require(ESM)` is enabled by default. Some test dependencies (jsdom → `html-encoding-sniffer` → `@exodus/bytes`) require this; on Node `<20.19.0`, `pnpm test` fails with `ERR_REQUIRE_ESM`.

### Running the Application

To start the development server:

```bash
pnpm run dev
```

The application will be available at `http://localhost:3000`.

## Testing

X-Talent provides end-to-end testing with predefined accounts. Use the following testing accounts to explore the platform:

Password should be asked other developers

| Role    | Email                          |
| ------- | ------------------------------ |
| Visitor | testing_visitor@xchange.com.tw |
| Mentee  | testing_mentee@xchange.com.tw  |
| Mentor  | testing_mentor@xchange.com.tw  |
