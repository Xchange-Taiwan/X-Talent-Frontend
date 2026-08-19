# X-Talent

X-Talent is a platform that connects mentors and mentees, providing a free resource for users to either find a mentor or become one to share their experiences with others.

## Website

Access the X-Talent testing website here: [X-Talent Testing Website](https://xtalent.vercel.app/)

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) - version `24.18.1` recommended (Node 22.22.2-22.x or 24.15.0-24.x also work; Node 23.x, 25.x, and anything below 22.22.2 are not supported)
- [pnpm](https://pnpm.io/) - version 9

### Installation

1. Install Node.js - we recommend version `24.18.1`:
   - Visit [Node.js](https://nodejs.org/) and download the installer for your operating system, or if you use a version manager like [nvm](https://github.com/nvm-sh/nvm), run `nvm install 24.18.1 && nvm use 24.18.1`.
   - Follow the installation instructions provided for your system.
   - Verify the installation by running:
     ```bash
     node -v
     ```
     You should see `v24.18.1` (Node 22.22.2-22.x or 24.15.0-24.x also work, but 24.18.1 is what the rest of the team uses - note that Node 23.x and 25.x are not supported).

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
   cd X-Talent-Frontend
   ```

5. Install project dependencies:

   ```bash
   pnpm install
   ```

6. Copy `.env.development.local` to the `X-Talent-Frontend` folder:
   - This file contains secrets and tokens required for development.
   - Please request this file from other developers.

### Running the Application

To start the development server:

```bash
pnpm run dev
```

The application will be available at `http://localhost:3000`.

## Tech Stack

- [Next.js](https://nextjs.org/) 16 (App Router) with React 18 and TypeScript
- [Tailwind CSS](https://tailwindcss.com/) with [Radix UI](https://www.radix-ui.com/) primitives
- [NextAuth.js](https://next-auth.js.org/) for authentication
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) for unit tests, [Playwright](https://playwright.dev/) for end-to-end tests
- [Storybook](https://storybook.js.org/) for component development
- [Sentry](https://sentry.io/) for error monitoring
- [Google Analytics 4](https://analytics.google.com/) and [Microsoft Clarity](https://clarity.microsoft.com/) for usage analytics

## Available Scripts

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `pnpm dev`             | Start the development server         |
| `pnpm build`           | Build the app for production         |
| `pnpm start`           | Start the production server          |
| `pnpm lint`            | Lint the codebase with ESLint        |
| `pnpm lint:fix`        | Lint and auto-fix issues             |
| `pnpm format`          | Format the codebase with Prettier    |
| `pnpm type-check`      | Run the TypeScript compiler checks   |
| `pnpm test`            | Run unit tests with Vitest           |
| `pnpm test:watch`      | Run unit tests in watch mode         |
| `pnpm test:e2e`        | Run end-to-end tests with Playwright |
| `pnpm storybook`       | Start Storybook locally              |
| `pnpm build-storybook` | Build the static Storybook site      |

> End-to-end tests require test account credentials in `.env.e2e.local`. Request these from the team; do not commit real credentials.
