# Contributing to mcpsx.run CLI

Thank you for your interest in contributing to the mcpsx.run CLI! This document provides guidelines and instructions for contributing.

## Development Setup

1. Clone the repository:
   ```
   git clone https://github.com/mcpsx/cli.git
   cd cli
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the project:
   ```
   npm run build
   ```

4. Link the package for local development:
   ```
   npm link
   ```

## Development Workflow

1. Create a feature branch:
   ```
   git checkout -b feature/your-feature-name
   ```

2. Make your changes
3. Run tests:
   ```
   npm run test
   ```

4. Ensure code quality:
   ```
   npm run lint
   ```

5. Build the project:
   ```
   npm run build
   ```

## Pull Request Process

1. Ensure your code follows the coding standards
2. Update documentation as needed
3. Include tests for new functionality
4. Ensure all tests pass
5. Submit a pull request with a clear description of the changes

## Code Review Guidelines

- All code changes require a code review
- Address all review comments before merging
- Maintain code quality and test coverage

## Coding Standards

- Follow the existing code style
- Use descriptive variable and function names
- Write meaningful comments
- Maintain type safety
- Handle errors appropriately

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).