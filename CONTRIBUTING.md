# Contributing to arcanaTeX

## Development environment

### Requirements

- Node.js 20+
- pnpm 10+
- TeX Live or MiKTeX (for local latex-api development)

### Setup

```bash
# Clone the repository
git clone https://github.com/mrphilo420/arcana-tex.git
cd arcana-tex

# Install dependencies
pnpm install

# Copy environment variables
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with your configuration

# Start the web app
pnpm dev:web

# In another terminal, start the LaTeX + sync API
pnpm --dir apps/latex-api dev
```

The web app runs at `http://localhost:3000`; the LaTeX/sync API runs at
`http://localhost:3001`.

### Running the LaTeX API locally

```bash
# Requires TeX Live or MiKTeX installed
pnpm --dir apps/latex-api dev
```

## Code style

This project uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
# Check code
pnpm lint

# Auto-fix issues
pnpm lint:fix
```

## Pull request process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run `pnpm lint` and the relevant builds/tests
5. Commit with a descriptive message
6. Push to your fork and open a PR

### Commit convention

Use conventional commits:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` code refactoring
- `chore:` maintenance tasks
