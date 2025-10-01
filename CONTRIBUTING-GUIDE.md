# 🤝 Canvas MCP Server - Contribution Guide

Your friend joining the project is excellent! Here's a comprehensive guide for contributing to the Canvas MCP server.

## 🔍 **Current Issues & Contribution Opportunities**

### 🚨 **Priority Issues (What Doesn't Work)**

#### 1. **Smart Search Functionality (HIGH PRIORITY)**
- **Issue**: `smart_search` tool has reliability problems
- **Location**: `/tools/smart-search.ts`, `/lib/content-extraction.ts`
- **Problems**: 
  - Inconsistent results depending on Canvas API permissions
  - Poor error handling when content extraction fails
  - Search relevance scoring needs improvement
- **Skills Needed**: TypeScript, search algorithms, API error handling

#### 2. **Content Extraction Reliability**
- **Issue**: Web discovery fails on some Canvas instances
- **Location**: `/lib/web-discovery.ts`, `/lib/content-extraction.ts`
- **Problems**:
  - Timeout handling
  - Canvas permission variations
  - PDF/document parsing inconsistencies
- **Skills Needed**: Web scraping, file parsing, error handling

#### 3. **Testing Infrastructure**
- **Issue**: No comprehensive test suite
- **Current State**: Only basic CI checks
- **Needed**: Unit tests, integration tests, mocking Canvas API
- **Skills Needed**: Jest/Vitest, API mocking, TypeScript testing

### 🛠 **Enhancement Opportunities**

#### 4. **Performance Optimization**
- **Caching improvements** for Canvas API calls
- **Rate limiting** handling
- **Memory usage** optimization for large courses

#### 5. **New Tool Development**
- **Gradebook analyzer** with trend analysis
- **Assignment deadline tracker** with notifications
- **Course analytics dashboard** data

#### 6. **Documentation & Developer Experience**
- **API documentation** generation
- **Example use cases** and tutorials
- **Development environment** setup automation

## 📋 **Development Workflow & Standards**

### **Branch Strategy**
```bash
main        # Production-ready code
develop     # Integration branch (create this)
feature/*   # New features
bugfix/*    # Bug fixes
hotfix/*    # Critical fixes
```

### **Pull Request Format**
```markdown
## 🎯 **What & Why**
- Brief description of changes
- Link to issue if applicable

## 🧪 **Testing**
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] TypeScript compilation passes
- [ ] No new linting errors

## 📝 **Checklist**
- [ ] Code follows existing patterns
- [ ] Comments added for complex logic
- [ ] Error handling implemented
- [ ] Documentation updated if needed

## 🔍 **How to Test**
1. Steps to reproduce/test the change
2. Expected behavior
3. Canvas course requirements (if any)
```

### **Code Standards**
```typescript
// ✅ Good: Clear function names, proper error handling
export async function extractCourseContent(
  courseId: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  try {
    logger.info(`[Content Extraction] Starting for course ${courseId}`);
    
    // Implementation with proper error boundaries
    
  } catch (error) {
    logger.error(`[Content Extraction] Failed: ${error.message}`);
    throw new Error(`Content extraction failed: ${error.message}`);
  }
}

// ❌ Avoid: Unclear names, no error handling
async function doStuff(id: string) {
  const result = await someApi(id);
  return result.data;
}
```

## 🚀 **Getting Started Guide**

### **1. Setup Development Environment**
```bash
# Clone and setup
git clone https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server.git
cd notioc-canvas-mcp-server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Add Canvas credentials to .env

# Build and test
npm run build
npm run dev
```

### **2. Create Feature Branch**
```bash
git checkout -b feature/improve-smart-search
```

### **3. Development Commands**
```bash
npm run build      # Compile TypeScript
npm run dev        # Start development server
npm run type-check # TypeScript type checking
npm test          # Run tests (when implemented)
```

## 🧪 **Testing Your Changes**

### **Manual Testing Setup**
```bash
# Test with Claude Desktop
# 1. Build the project
npm run build

# 2. Update Claude config
# Add to ~/.config/claude_desktop_config.json:
{
  "mcpServers": {
    "canvas-local": {
      "command": "node",
      "args": ["/path/to/your/notioc-canvas-mcp-server/dist/src/server.js"],
      "env": {
        "CANVAS_BASE_URL": "your-canvas-url",
        "CANVAS_ACCESS_TOKEN": "your-token"
      }
    }
  }
}

# 3. Test specific functionality
# Try these queries in Claude:
# - "Search for lecture notes about quantum mechanics"
# - "Show me my upcoming assignments"
# - "Find files related to homework 3"
```

### **Issue Reproduction**
```bash
# To test smart_search issues:
# 1. Try search in a course with restricted APIs
# 2. Search for terms that should return results but don't
# 3. Check console logs for error patterns
```

## 🎯 **Specific Contribution Ideas**

### **For Smart Search Fix (URGENT)**
```typescript
// Focus areas in /tools/smart-search.ts:
// 1. Fix error handling in performSmartSearch()
// 2. Improve relevance scoring algorithm
// 3. Add fallback search methods
// 4. Better handling of API restrictions

// Example improvement:
async function performSmartSearch(params: SmartSearchParams) {
  try {
    // Current search logic...
  } catch (error) {
    // ADD: Fallback search strategy
    logger.warn(`Primary search failed, trying fallback: ${error.message}`);
    return await fallbackSearch(params);
  }
}
```

### **For Testing Infrastructure**
```typescript
// Create: /tests/smart-search.test.ts
describe('Smart Search', () => {
  it('should handle API restrictions gracefully', async () => {
    // Mock Canvas API with restricted responses
    // Test search functionality
    // Assert proper fallback behavior
  });
});
```

### **For Documentation**
```markdown
# Create: /docs/API.md
# Document all 45 tools with examples
# Create troubleshooting guide
# Add development setup videos
```

## ⚡ **Quick Wins (Easy First Contributions)**

1. **Add ESLint configuration** (`.eslintrc.js`)
2. **Improve error messages** with more context
3. **Add TypeScript strict mode** fixes
4. **Create unit tests** for utility functions
5. **Update README** with better examples

## 🚨 **Important Notes**

### **Canvas API Limitations**
- Different institutions have different API permissions
- Rate limiting varies by instance
- Some features only work with admin tokens

### **Security Considerations**
- Never commit API tokens
- Validate all user inputs
- Handle Canvas API errors gracefully
- Use environment variables for config

### **Performance Guidelines**
- Cache API responses when possible
- Implement proper rate limiting
- Use streaming for large data sets
- Optimize TypeScript compilation

Your friend should start with the **Smart Search fix** as it's the most impactful broken feature, then move to testing infrastructure to prevent future regressions! 🎯
