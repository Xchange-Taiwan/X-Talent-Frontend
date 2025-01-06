# XTalent

XTalent is a platform that connects mentors and mentees, providing a free resource for users to either find a mentor or become one to share their experiences with others.

## Website

Access the XTalent testing website here: [XTalent Testing Website](https://xtalent.vercel.app/)

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 20)
- [pnpm](https://pnpm.io/) (version 8)

### Installation

1. Install Node.js (version 20):

   - Visit [Node.js](https://nodejs.org/) and download the version 20 installer for your operating system.
   - Follow the installation instructions provided for your system.
   - Verify the installation by running:
     ```bash
     node -v
     ```
     You should see the version number `20.x.x`.

2. Install PNPM (version 8):

   - Run the following command to install PNPM globally:
     ```bash
     npm install -g pnpm@8
     ```
   - Verify the installation by running:
     ```bash
     pnpm -v
     ```
     You should see the version number `8.x.x`.

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

### Running the Application

To start the development server:

```bash
pnpm run dev
```

The application will be available at `http://localhost:3000`.

## Testing

XTalent provides end-to-end testing with predefined accounts. Use the following testing accounts to explore the platform:

Password should be asked other developers

| Role    | Email                          |
| ------- | ------------------------------ |
| Visitor | testing_visitor@xchange.com.tw |
| Mentee  | testing_mentee@xchange.com.tw  |
| Mentor  | testing_mentor@xchange.com.tw  |
