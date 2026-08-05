# X-Talent

X-Talent is a platform that connects mentors and mentees, providing a free resource for users to either find a mentor or become one to share their experiences with others.

## Website

Access the X-Talent testing website here: [X-Talent Testing Website](https://xtalent.vercel.app/)

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (`^22.22.2`, `^24.15.0`, or `>=26.0.0`)
- [pnpm](https://pnpm.io/) (version 9)

### Installation

1. Install Node.js (`^22.22.2`, `^24.15.0`, or `>=26.0.0`):
   - Visit [Node.js](https://nodejs.org/) and download a matching installer for your operating system.
   - Follow the installation instructions provided for your system.
   - Verify the installation by running:
     ```bash
     node -v
     ```
     You should see a version matching one of the ranges above.

2. Install PNPM (version 9.15.9):
   - Run the following command to install PNPM globally:
     ```bash
     npm install -g pnpm@9.15.9
     ```
   - Verify the installation by running:
     ```bash
     pnpm -v
     ```
     You should see the version number `9.15.9`.

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

This project requires Node `^22.22.2 || ^24.15.0 || >=26.0.0` (declared in `package.json` `engines`) and enforces it via `.npmrc` (`engine-strict=true`). Node 20 is no longer supported. `.nvmrc` pins `24.18.1` for tooling that reads it.

- **`ERR_PNPM_UNSUPPORTED_ENGINE` / `Unsupported engine`** — Your Node version doesn't match `^22.22.2 || ^24.15.0 || >=26.0.0`. Upgrade before running `pnpm install`. To install/switch to a supported version:
  - With **nvm**: `nvm install 24.18.1 && nvm use 24.18.1`
  - With **fnm**: `fnm use` (auto-reads `.nvmrc`)
  - With **Volta**: `volta install node@24.18.1`
- **Wrong package manager** — Always use `pnpm`, not `npm` or `yarn`. The lockfile and version enforcement are pnpm-specific.

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
