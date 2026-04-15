# Loan API Automation

A comprehensive API automation testing framework for loan lifecycle management with mock server, tests, and documentation.

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/paulabinongo/api-automation-testing.git
cd api-automation-testing
npm install

# Run tests
npm test

# Start mock server with Swagger UI
npm run start:mock
# Visit http://127.0.0.1:8765/docs for interactive API docs
```

## 📋 Overview

- **Mock API Server** - Local development server with full loan lifecycle
- **Automated Tests** - Vitest-based unit and integration tests
- **OpenAPI Contract** - Machine-readable API specification
- **Postman Collections** - Ready-to-import API workflows
- **Documentation** - Complete guide and reference

## 🏗️ Project Structure

```
/
|-- src/                    # Source code
|   |-- api/               # API client code
|   |-- config/            # Configuration files
|   |-- loan-products/     # Loan product logic
|   |   |-- types/         # Loan type definitions (auto, home, personal)
|   |   |-- calculations/  # Computation and eligibility logic
|   |   `-- shared/        # Shared utilities
|   `-- utils/             # Utility functions
|-- tests/                  # All test files
|   |-- unit/              # Unit tests
|   |-- integration/       # Integration tests
|   `-- helpers/           # Test helpers
|-- mock-server/            # Mock API server
|-- config/                 # Development configuration
|-- postman/                # Postman collections and environments
|-- docs/                   # Documentation
`-- scripts/                # Build and automation scripts
```

## 📚 Documentation

**Complete Guide:** [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)

**Key Sections:**
- Loan lifecycle walkthrough
- API reference and examples
- Testing strategies
- Development workflows
- Product catalog details

## 🔧 Available Scripts

```bash
npm test              # Run all tests
npm run test:watch     # Watch mode for development
npm run test:coverage  # Generate coverage report
npm run start:mock     # Start mock server
npm run lint           # Code linting
npm run format         # Code formatting
```

## 📡 API Endpoints

- **Mock Server:** `http://127.0.0.1:8765`
- **Swagger UI:** `http://127.0.0.1:8765/docs`
- **OpenAPI Spec:** `http://127.0.0.1:8765/openapi.json`

## 🛠️ Tech Stack

- **Node.js 20+** - Runtime environment
- **Vitest** - Testing framework
- **Express** - Mock server
- **OpenAPI 3.0** - API specification
- **Postman** - API testing collections
