# 🔍 Smart Search Debugging Guide

## **Problem Analysis**

The smart search functionality has several potential failure points. Here's a systematic debugging approach for your friend.

## **Quick Debug Steps**

### **1. Test Smart Search Manually**
```bash
# In your Terminal:
cd /Users/kuriambatia/Desktop/notioc-canvas-mcp-server

# Test the built version
npm run build

# Test with Claude Desktop using these queries:
# 1. "Search for assignment instructions in course 12345"
# 2. "Find lecture notes about specific topic"
# 3. "Show me files related to homework"
```

### **2. Check Common Issues**

#### **Canvas API Permissions**
```typescript
// The most common issue: Canvas API restrictions
// Add debugging to tools/smart-search.ts around line 180:

logger.info(`[Smart Search Debug] Attempting search with:
  - Course ID: ${params.courseId}
  - Query: "${params.query}"
  - Canvas URL: ${params.canvasBaseUrl}
  - Force Refresh: ${params.forceRefresh}`);

// Check the underlying search response
const searchResponse = await smartSearch({
  canvasBaseUrl: params.canvasBaseUrl,
  accessToken: params.accessToken,
  courseId: validCourseId,
  query: params.query,
  forceRefresh: params.forceRefresh,
  includeContent: params.includeContent
});

logger.info(`[Smart Search Debug] Raw response:`, JSON.stringify(searchResponse, null, 2));
```

#### **Content Extraction Failures**
```typescript
// Add to lib/content-extraction.ts around the smartSearch function:

export async function smartSearch(params: SmartSearchParams): Promise<SmartSearchResult> {
  logger.info(`[Content Extraction Debug] Starting search:`, {
    courseId: params.courseId,
    query: params.query,
    includeContent: params.includeContent
  });

  try {
    // ... existing code ...
  } catch (error) {
    logger.error(`[Content Extraction Debug] Search failed:`, {
      error: error.message,
      stack: error.stack,
      params: params
    });
    throw error;
  }
}
```

## **Specific Issues & Fixes**

### **Issue 1: Canvas API Rate Limiting**
```typescript
// In lib/content-extraction.ts, add retry logic:

async function makeCanvasRequest(url: string, options: any, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
        logger.warn(`[Canvas API] Rate limited, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      logger.warn(`[Canvas API] Request failed, retrying: ${error.message}`);
    }
  }
}
```

### **Issue 2: Search Result Relevance**
```typescript
// In tools/smart-search.ts, improve the relevance scoring:

function calculateRelevance(item: any, query: string): number {
  const queryLower = query.toLowerCase();
  const title = (item.name || item.fileName || '').toLowerCase();
  const content = (item.content || item.description || '').toLowerCase();
  
  let score = 0;
  
  // Exact title match gets highest score
  if (title.includes(queryLower)) {
    score += 10;
  }
  
  // Partial word matches in title
  const queryWords = queryLower.split(' ');
  queryWords.forEach(word => {
    if (title.includes(word)) score += 3;
    if (content.includes(word)) score += 1;
  });
  
  // Recent files get bonus points
  if (item.updatedAt) {
    const daysSinceUpdate = (Date.now() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) score += 2;
  }
  
  return Math.min(score, 10); // Cap at 10
}
```

### **Issue 3: Error Handling**
```typescript
// Replace the current error handling in performSmartSearch with:

} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  logger.error(`[Smart Search Tool] Search failed:`, {
    error: errorMsg,
    stack: error instanceof Error ? error.stack : undefined,
    params: {
      courseId: params.courseId,
      query: params.query,
      canvasBaseUrl: params.canvasBaseUrl?.substring(0, 30) + '...' // Don't log full URL
    }
  });
  
  // Try a fallback simple search
  try {
    logger.info(`[Smart Search Tool] Attempting fallback search`);
    const fallbackResult = await performFallbackSearch(params);
    return fallbackResult;
  } catch (fallbackError) {
    logger.error(`[Smart Search Tool] Fallback search also failed: ${fallbackError.message}`);
  }
  
  // Return structured error
  return createErrorResult(params, errorMsg, returnMode);
}

// Add this fallback function:
async function performFallbackSearch(params: SmartSearchParams): Promise<any> {
  // Simple file and page search without content extraction
  // This should work even when advanced features fail
  
  const headers = {
    'Authorization': `Bearer ${params.accessToken}`,
    'Content-Type': 'application/json'
  };
  
  const [filesResponse, pagesResponse] = await Promise.allSettled([
    fetch(`${params.canvasBaseUrl}/api/v1/courses/${params.courseId}/files?search_term=${encodeURIComponent(params.query)}`, { headers }),
    fetch(`${params.canvasBaseUrl}/api/v1/courses/${params.courseId}/pages?search_term=${encodeURIComponent(params.query)}`, { headers })
  ]);
  
  const files = filesResponse.status === 'fulfilled' && filesResponse.value.ok 
    ? await filesResponse.value.json() 
    : [];
    
  const pages = pagesResponse.status === 'fulfilled' && pagesResponse.value.ok 
    ? await pagesResponse.value.json() 
    : [];
  
  return {
    success: true,
    query: params.query,
    courseInfo: { courseId: params.courseId },
    results: { files, pages, links: [] },
    metadata: { 
      totalResults: files.length + pages.length,
      discoveryMethod: 'fallback'
    }
  };
}
```

## **Testing Your Fixes**

### **1. Create a Test Script**
```javascript
// Create: test-smart-search-debug.js

const { performSmartSearch } = require('./dist/tools/smart-search.js');

async function testSmartSearch() {
  console.log('🔍 Testing Smart Search...');
  
  const params = {
    canvasBaseUrl: process.env.CANVAS_BASE_URL,
    accessToken: process.env.CANVAS_ACCESS_TOKEN,
    courseId: 'YOUR_TEST_COURSE_ID', // Replace with actual course ID
    query: 'assignment',
    maxResults: 5,
    returnMode: 'refs'
  };
  
  try {
    const result = await performSmartSearch(params);
    console.log('✅ Success!', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSmartSearch();
```

### **2. Run the Test**
```bash
# Build first
npm run build

# Run test
node test-smart-search-debug.js
```

### **3. Check Logs**
```bash
# Enable debug logging in your .env:
echo "LOG_LEVEL=debug" >> .env

# Run and check logs
npm run build && node test-smart-search-debug.js 2>&1 | grep -E "(Smart Search|Content Extraction)"
```

## **Common Canvas API Issues**

### **Permission Problems**
- Student tokens can't access all course data
- Some institutions restrict API access
- Cross-origin issues with certain Canvas instances

### **Configuration Issues**
- Wrong Canvas base URL format
- Expired or invalid access tokens
- Course ID not accessible to the token

### **Performance Issues**
- Large courses timeout during content extraction
- Rate limiting kicks in with multiple requests
- Memory issues with heavy content processing

## **Quick Fixes to Try First**

1. **Add more logging** to see exactly where it fails
2. **Test with a simple course** (small, recent content)
3. **Check Canvas API directly** in browser/Postman
4. **Try different search terms** (simple vs complex)
5. **Test fallback mode** without content extraction

Your friend should start with adding the debug logging, then test with a simple course and basic search terms! 🎯
