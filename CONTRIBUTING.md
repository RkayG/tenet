# Contributing to Tenet

First off, thank you for considering contributing to Tenet! It's people like you that make Tenet such a great tool for the community.

## 🌈 Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please be respectful and professional in all interactions.

## 🚀 How to Contribute

### 1. Reporting Bugs
*   Check the [Issues](https://github.com/RkayG/tenet/issues) to see if the bug has already been reported.
*   If not, open a new issue. Clearly describe the problem and include steps to reproduce.
*   Attach logs or screenshots if relevant.

### 2. Suggesting Enhancements
*   Open an issue with the tag `enhancement`.
*   Explain the "why" behind the feature. Who does it benefit?
*   Provide examples of how the API should look.

### 3. Pull Requests
*   **Fork** the repo and create your branch from `main`.
*   If you've added code that should be tested, add tests.
*   If you've changed APIs, update the documentation.
*   Ensure the test suite passes (`pnpm test`).
*   Make sure your code lints (`pnpm lint`).

## 🛠️ Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/tenet.git
cd tenet

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run linting
pnpm lint
```

## 🏗️ Project Structure

*   `src/core`: The request pipeline and handler engine.
*   `src/auth`: Identity and authentication strategies.
*   `src/multitenancy`: The heart of Tenet – isolation logic and strategies.
*   `src/audit`: Compliance-grade event logging.
*   `docs/`: Comprehensive technical documentation.

## 📝 Coding Standards

*   Use **camelCase** for variables and functions.
*   Use **PascalCase** for classes and interfaces.
*   Always include **JSDoc** for public APIs.
*   Follow the "Security by Default" philosophy: Never trust client input.

## ⚖️ License
By contributing, you agree that your contributions will be licensed under its MIT License.
