# Contributing to Notioc Canvas MCP Server

Thank you for your interest in contributing to the Notioc Canvas MCP Server! This project helps bring Canvas LMS integration to Claude Desktop through the Model Context Protocol.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/canvas-mcp-server.git
   cd canvas-mcp-server
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up your environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Canvas API credentials
   ```
5. **Build the project**:
   ```bash
   npm run build
   ```

## Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make your changes** and test them locally
3. **Test the MCP server**:
   ```bash
   npm run test
   ```
4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: description of your changes"
   ```
5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Create a Pull Request** on GitHub

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting patterns
- Add comments for complex logic
- Keep functions focused and single-purpose

## Testing

Before submitting a pull request:

1. **Test the MCP server**: `npm run test`
2. **Test with Claude Desktop**: Verify integration works
3. **Check for TypeScript errors**: `npm run build`

## Reporting Issues

When reporting issues, please include:

1. **Environment details**: OS, Node.js version, Claude Desktop version
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**
4. **Error messages** (if any)
5. **Canvas instance type** (if relevant)

## Feature Requests

We welcome feature requests! Please:

1. **Check existing issues** to avoid duplicates
2. **Describe the use case** clearly
3. **Explain the expected benefit**
4. **Consider implementation complexity**

## Security

- Never commit API keys or sensitive data
- Report security issues privately to the maintainers
- Use environment variables for all credentials

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for helping make Canvas integration better for everyone! 🎓✨
