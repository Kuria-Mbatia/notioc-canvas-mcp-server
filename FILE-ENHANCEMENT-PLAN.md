# 📋 COMPREHENSIVE PLAN: Enhanced File Discovery & Document Processing with LlamaParse

## 🎯 OBJECTIVES

### Primary Goals
1. **Enhanced File Discovery**: Create a powerful file browsing experience with folder hierarchy support
2. **Smart File Categorization**: Automatically categorize files by type, size, processing capability
3. **LlamaParse Integration**: Seamless document processing with intelligent routing
4. **Agentic File Exploration**: Enable Claude to autonomously discover and process relevant documents
5. **Context-Aware Recommendations**: Suggest which files to process based on relevance and capability

### User Experience Goals
- Claude sees **organized file structure** (not just flat lists)
- Claude knows **which files can be processed** by LlamaParse
- Claude can **autonomously decide** which files are relevant
- Claude provides **actionable suggestions** for document processing

---

## 🔍 CURRENT STATE ANALYSIS

### Existing Tools (3 file tools)
| Tool | Purpose | Strengths | Limitations |
|------|---------|-----------|-------------|
| `find_files` | Search files in course | Fuzzy search, module context | Flat list, no folder structure, no file metadata |
| `read_file` | Read file by name/ID in course | Supports cache, preview mode | Requires course context |
| `read_file_by_id` | Read file by ID directly | No course needed | Limited metadata |

### Existing Infrastructure
✅ **LlamaParse Integration**: Fully implemented in `lib/llamaparse.ts`
- Supports 100+ file types (PDF, Office docs, images, audio)
- Smart error handling with graceful fallbacks
- File size limits (50MB default, 20MB audio)
- Result formats: markdown, text, json

✅ **File Caching System**: Implemented in `lib/file-cache.ts`
- Cache with ETags and revalidation
- Preview mode for token efficiency
- Compression for large documents

✅ **Canvas API Client**: Ready in `lib/canvas-api.ts`
- Supports all Files API endpoints
- Folder hierarchy support
- Pagination built-in

### Current Workflow Gaps
❌ **No folder browsing** - Users can't explore file structure
❌ **No file metadata display** - Size, type, processing capability not shown
❌ **No LlamaParse awareness** - Claude doesn't know which files are supported
❌ **No batch processing** - Can't process multiple related files
❌ **No smart recommendations** - No suggestions for which files to explore

---

## 🏗️ PROPOSED SOLUTION ARCHITECTURE

### New Tool: `get_files` (Enhanced File Discovery)

**Purpose**: Comprehensive file browsing with folder hierarchy, metadata, and processing capability indicators

**Key Features**:
1. **Hierarchical Display**: Show folder structure with nesting
2. **Rich Metadata**: Size, type, updated date, lock status
3. **Processing Indicators**: Show which files support LlamaParse
4. **Smart Categorization**: Group by type (Documents, Spreadsheets, Images, Audio, Other)
5. **Summary Statistics**: Total files, processable count, total size
6. **Folder Navigation**: Browse into folders, show parent path
7. **Filter Options**: By content type, folder, locked status
8. **Sort Options**: By name, size, date, type

**Design**:
```typescript
interface GetFilesParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  
  // Browsing options
  folderId?: string;           // Browse specific folder (default: root)
  folderPath?: string;         // Browse by path (e.g., "Week 1/Readings")
  recursive?: boolean;         // Include subfolders (default: true)
  
  // Filtering options
  contentTypes?: string[];     // Filter by MIME type
  searchTerm?: string;         // Search file names
  showHidden?: boolean;        // Include hidden files (default: false)
  showLocked?: boolean;        // Include locked files (default: true)
  includeFromModules?: boolean; // Also show files from modules (default: true)
  
  // Display options
  groupBy?: 'folder' | 'type' | 'none';  // How to organize results
  sortBy?: 'name' | 'size' | 'date' | 'type';
  sortOrder?: 'asc' | 'desc';
  showProcessable?: boolean;   // Highlight LlamaParse-supported files
  
  // LlamaParse context
  llamaParseEnabled?: boolean;  // Auto-detected from env
}

interface EnhancedFileInfo {
  // Core properties
  id: string;
  name: string;
  displayName: string;
  url: string;
  
  // Metadata
  size: number;
  sizeFormatted: string;  // "2.5 MB"
  contentType: string;
  mimeClass: string;      // "pdf", "doc", "image", etc.
  
  // Dates
  createdAt: string;
  updatedAt: string;
  modifiedAt: string | null;
  
  // Location
  folderId: number | null;
  folderPath: string;     // "course files/Week 1/Readings"
  moduleName: string | null;
  
  // Status
  locked: boolean;
  lockedForUser: boolean;
  lockExplanation: string | null;
  hidden: boolean;
  hiddenForUser: boolean;
  
  // Processing capability
  llamaParseSupported: boolean;
  processingRecommendation: 'highly-recommended' | 'recommended' | 'supported' | 'not-supported';
  estimatedProcessingTime?: string;  // "~5s" for small PDFs
  
  // Additional
  thumbnailUrl: string | null;
  previewUrl: string | null;
}

interface FolderInfo {
  id: number;
  name: string;
  fullName: string;      // "course files/Week 1"
  parentFolderId: number | null;
  filesCount: number;
  foldersCount: number;
  position: number;
  locked: boolean;
  hidden: boolean;
  forSubmissions: boolean;
}

interface GetFilesResult {
  // Files
  files: EnhancedFileInfo[];
  fileCount: number;
  
  // Folders (if browsing)
  folders: FolderInfo[];
  folderCount: number;
  currentFolder: FolderInfo | null;
  parentFolder: FolderInfo | null;
  breadcrumb: string[];   // ["course files", "Week 1", "Readings"]
  
  // Statistics
  totalSize: number;
  totalSizeFormatted: string;
  processableCount: number;
  filesByType: Record<string, number>;
  
  // Processing context
  llamaParseEnabled: boolean;
  llamaParseConfig: {
    maxFileSizeMB: number;
    supportedExtensions: string[];
    resultFormat: string;
  };
  
  // Recommendations
  suggestions: string[];  // ["3 PDFs ready for processing", "2 large files may take longer"]
}
```

### Enhanced Output Format

**Example 1: Root Folder Browse**
```
📁 COURSE FILES: Data Science 410
════════════════════════════════════════

📊 SUMMARY
  Total: 47 files (234.5 MB)
  Processable: 31 files (189.2 MB)
  Folders: 8

📁 FOLDERS (8)
────────────────
  📁 Week 1 - Introduction (8 files, 45.2 MB)
  📁 Week 2 - Data Visualization (12 files, 78.3 MB)
  📁 Week 3 - Machine Learning (15 files, 89.1 MB)
  📁 Assignments (5 files, 12.4 MB)
  📁 Resources (3 files, 8.7 MB)
  📁 Datasets (4 files, 0.8 MB)

📄 DOCUMENTS (18 files - LlamaParse Supported ✓)
────────────────────────────────────────
  📄 Syllabus.pdf
     Size: 2.5 MB | Updated: Sep 15, 2024
     🔥 Recommended for processing
     To process: Use read_file_by_id with fileId: 176870249
  
  📄 Course_Overview.docx
     Size: 856 KB | Updated: Sep 12, 2024
     ✓ Can be processed
     To process: Use read_file_by_id with fileId: 176870250

📊 SPREADSHEETS (5 files - LlamaParse Supported ✓)
──────────────────────────────────────────
  📊 Grade_Template.xlsx
     Size: 124 KB | Updated: Sep 10, 2024
     To process: Use read_file_by_id with fileId: 176870251

🖼️ IMAGES (3 files - LlamaParse Supported ✓)
─────────────────────────────────────────
  🖼️ course_banner.png
     Size: 456 KB | Updated: Aug 30, 2024
     ℹ️ OCR available via LlamaParse

📁 OTHER FILES (3 files)
────────────────────────
  📦 dataset.zip
     Size: 45.2 MB | Updated: Sep 5, 2024
     ⚠️ Not processable (compressed file)

💡 SUGGESTIONS
────────────────
  • 18 documents ready for immediate processing
  • Start with "Syllabus.pdf" for course overview
  • Navigate to "Week 1 - Introduction" for lecture materials
  • 3 large files (>20MB) may take longer to process

🎯 NAVIGATION
──────────────
  • To browse a folder: Use get_files with folderId or folderPath
  • To process a file: Use read_file_by_id with the file ID
  • To search: Use get_files with searchTerm parameter
```

**Example 2: Folder Browse with Filter**
```
📁 Week 1 - Introduction / Readings
════════════════════════════════════

📊 SUMMARY
  Location: course files/Week 1 - Introduction/Readings
  Files: 6 (23.4 MB)
  Processable: 6 (100%)

📄 PDF DOCUMENTS (6 files - All LlamaParse Supported ✓)
────────────────────────────────────────────────────────
  1. 📄 Lecture_01_Intro_to_DS.pdf
     Size: 8.2 MB | Updated: Sep 16, 2024
     🔥 Highly recommended - Core course material
     Est. processing: ~15s
     To process: Use read_file_by_id with fileId: 176870252
  
  2. 📄 Reading_DataScience_Foundations.pdf
     Size: 6.7 MB | Updated: Sep 14, 2024
     ✓ Recommended
     Est. processing: ~12s
     To process: Use read_file_by_id with fileId: 176870253
  
  3. 📄 Paper_MachineLearning_Overview.pdf
     Size: 4.1 MB | Updated: Sep 12, 2024
     To process: Use read_file_by_id with fileId: 176870254
  
  [... more files ...]

💡 BATCH PROCESSING SUGGESTION
──────────────────────────────
  All 6 PDFs in this folder are lecture materials.
  Recommended: Process in order (1→6) for comprehensive understanding.
  Total est. time: ~45 seconds

🎯 NAVIGATION
──────────────
  ⬆️  Parent: Use get_files with folderPath: "Week 1 - Introduction"
  🏠 Root: Use get_files without folderId/folderPath
  🔍 Filter by type: Use contentTypes parameter
```

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Core Infrastructure (1-2 hours)
**File**: `lib/files-enhanced.ts`

1. **Create Enhanced File API Client**
   ```typescript
   - fetchFolderHierarchy()
   - fetchFilesWithMetadata()
   - buildFolderTree()
   - categorizeFilesByType()
   - calculateProcessingCapability()
   - generateFileRecommendations()
   ```

2. **Integrate with Existing Systems**
   - Use existing `canvasApi` client
   - Leverage existing `llamaparse.isFileSupported()`
   - Use existing `pagination` utilities
   - Integrate with `file-cache` system

3. **Type Definitions**
   - Create comprehensive TypeScript interfaces
   - Support all Canvas File API fields
   - Add LlamaParse metadata extensions

### Phase 2: Tool Implementation (1 hour)
**File**: `tools/files-enhanced.ts`

1. **Implement `getFiles()` function**
   - Parameter validation
   - Course resolution (name → ID)
   - Folder resolution (path → ID)
   - API calls with pagination
   - Metadata enrichment
   - Categorization logic
   - Recommendation generation

2. **Implement helper functions**
   - `formatFileSize(bytes): string`
   - `categorizeFile(file): FileCategory`
   - `getProcessingRecommendation(file): RecommendationLevel`
   - `estimateProcessingTime(file): string`
   - `generateBreadcrumb(folderPath): string[]`

### Phase 3: MCP Integration (30 minutes)
**File**: `mcp.ts`

1. **Register `get_files` tool**
   - Comprehensive description
   - Full parameter schema with examples
   - Required vs optional parameters

2. **Implement handler**
   - Extract and validate parameters
   - Call `getFiles()` function
   - Format rich response
   - Error handling with context

3. **Update existing tools**
   - Enhance `find_files` description to mention `get_files`
   - Update `read_file_by_id` description
   - Add cross-references in tool help

### Phase 4: Documentation & Guidance (30 minutes)
**Files**: `lib/tool-help.ts`, `lib/tool-metadata.ts`, `lib/llm-guidance.ts`

1. **Tool Help** - Add comprehensive examples:
   ```
   - "How do I browse files?" → Use get_files
   - "Which files can be processed?" → Use get_files with showProcessable
   - "How do I navigate folders?" → Use get_files with folderId/folderPath
   ```

2. **Tool Metadata** - Update categories:
   - Add `get_files` to "course_content" category
   - Set high relevance score
   - Add keyword associations

3. **LLM Guidance** - Add workflows:
   ```
   - File Discovery: "When asked about course files, use get_files first"
   - Document Processing: "Check file capabilities before processing"
   - Batch Operations: "Suggest processing related files together"
   ```

### Phase 5: Enhanced Display Logic (1 hour)
**File**: `mcp.ts` handler

1. **Smart Grouping**
   - Group by folder (hierarchical)
   - Group by type (Documents, Spreadsheets, Images, etc.)
   - Group by processability

2. **Visual Indicators**
   - 📄 PDF documents
   - 📊 Spreadsheets
   - 🖼️ Images
   - 🎵 Audio files
   - 📁 Folders
   - 🔥 Highly recommended
   - ✓ Processable
   - ⚠️ Large file warning
   - 🔒 Locked status

3. **Contextual Suggestions**
   - Based on file types present
   - Based on folder structure
   - Based on file names (detect lectures, assignments, etc.)
   - Based on course module context

### Phase 6: Integration with LlamaParse (30 minutes)
**Files**: `mcp.ts`, `tools/files-enhanced.ts`

1. **Auto-detect LlamaParse config**
   - Check environment variables
   - Show capabilities in response
   - Provide clear enable instructions if disabled

2. **Processing recommendations**
   - Priority: Syllabus, lectures, assignments
   - Warn about large files
   - Suggest optimal processing order
   - Estimate processing times

3. **Batch processing hints**
   - Identify related files
   - Suggest processing together
   - Provide aggregation suggestions

---

## 🎨 DETAILED IMPLEMENTATION

### Tool Schema
```typescript
{
  name: 'get_files',
  description: `Comprehensive file browser for Canvas courses with folder hierarchy, rich metadata, and LlamaParse processing indicators. 

Shows:
• Organized folder structure with navigation
• File details: size, type, dates, lock status
• Which files can be processed by LlamaParse (PDF, Office, images, audio)
• Processing recommendations and time estimates
• Summary statistics and actionable suggestions

Use this to:
• Explore course file structure
• Find documents to process and analyze
• Identify relevant materials for assignments
• Check which files support advanced processing
• Get processing recommendations

Better than find_files because it shows:
✓ Folder hierarchy (not flat list)
✓ Processing capability (which files work with LlamaParse)
✓ Rich metadata (size, type, dates)
✓ Smart recommendations (what to process first)
✓ Navigation context (parent folders, breadcrumb)`,
  
  inputSchema: {
    type: 'object',
    properties: {
      courseId: {
        type: 'string',
        description: 'The Canvas course ID (numeric)'
      },
      courseName: {
        type: 'string',
        description: 'The course name (e.g., "Data Science 410"). If provided, courseId is not required.'
      },
      folderId: {
        type: 'string',
        description: 'Browse a specific folder by ID. Omit to browse root folder.'
      },
      folderPath: {
        type: 'string',
        description: 'Browse by folder path (e.g., "Week 1/Readings"). Alternative to folderId.'
      },
      recursive: {
        type: 'boolean',
        description: 'Include files from subfolders (default: true)',
        default: true
      },
      contentTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by content types (e.g., ["application/pdf", "image"])'
      },
      searchTerm: {
        type: 'string',
        description: 'Search file names (fuzzy matching)'
      },
      groupBy: {
        type: 'string',
        enum: ['folder', 'type', 'none'],
        description: 'How to organize results (default: type)',
        default: 'type'
      },
      sortBy: {
        type: 'string',
        enum: ['name', 'size', 'date', 'type'],
        description: 'Sort order (default: name)',
        default: 'name'
      },
      showHidden: {
        type: 'boolean',
        description: 'Include hidden files (default: false)',
        default: false
      },
      includeFromModules: {
        type: 'boolean',
        description: 'Also include files referenced in course modules (default: true)',
        default: true
      }
    }
  }
}
```

### Handler Implementation Structure
```typescript
case 'get_files': {
  // 1. Extract and validate parameters
  const { courseId, courseName, folderId, folderPath, ... } = args;
  
  // 2. Resolve course
  let resolvedCourseId = courseId;
  if (!resolvedCourseId && courseName) {
    resolvedCourseId = await resolveCourse(courseName);
  }
  
  // 3. Call enhanced getFiles function
  const result = await getFiles({
    canvasBaseUrl,
    accessToken,
    courseId: resolvedCourseId,
    folderId,
    folderPath,
    ...otherParams
  });
  
  // 4. Format rich response
  let markdown = formatFileResponse(result);
  
  // 5. Return with metadata
  return {
    content: [{
      type: 'text',
      text: markdown
    }],
    isError: false,
    _meta: {
      fileCount: result.fileCount,
      processableCount: result.processableCount,
      totalSize: result.totalSize,
      llamaParseEnabled: result.llamaParseEnabled
    }
  };
}
```

---

## 🧪 TESTING STRATEGY

### Unit Tests
1. **File categorization**
   - Test MIME type detection
   - Test LlamaParse support detection
   - Test recommendation logic

2. **Folder hierarchy**
   - Test breadcrumb generation
   - Test parent/child relationships
   - Test path resolution

3. **Formatting**
   - Test file size formatting
   - Test date formatting
   - Test markdown generation

### Integration Tests
1. **Canvas API**
   - Test folder listing
   - Test file metadata retrieval
   - Test pagination

2. **LlamaParse integration**
   - Test capability detection
   - Test recommendation generation
   - Test configuration display

### User Scenarios
1. **"Show me all files in this course"**
   - Expected: Organized by folder/type, summary stats, suggestions

2. **"Which files can be processed?"**
   - Expected: Filtered list with LlamaParse support indicators

3. **"Navigate to Week 1 readings"**
   - Expected: Folder contents, breadcrumb, parent navigation

4. **"Find all PDFs"**
   - Expected: Filtered to PDFs, processing recommendations

---

## 📊 SUCCESS METRICS

### Functionality
- ✅ Shows folder hierarchy with navigation
- ✅ Displays rich file metadata (size, type, dates)
- ✅ Indicates LlamaParse processing capability
- ✅ Provides processing recommendations
- ✅ Generates summary statistics
- ✅ Supports filtering and sorting
- ✅ Handles large course file structures

### User Experience
- ✅ Claude can autonomously explore file structure
- ✅ Claude knows which files to process
- ✅ Claude provides relevant file suggestions
- ✅ Claude understands folder context
- ✅ Responses are token-efficient
- ✅ Visual indicators are clear and helpful

### Integration
- ✅ Works with existing file tools
- ✅ Leverages existing LlamaParse infrastructure
- ✅ Maintains caching behavior
- ✅ Follows existing error handling patterns
- ✅ Consistent with other enhanced tools (modules, pages)

---

## 🚀 ROLLOUT PLAN

### Development Order
1. **Start**: Create `lib/files-enhanced.ts` with core functions
2. **Implement**: `getFiles()` with all parameters
3. **Integrate**: Add to `mcp.ts` as new tool
4. **Enhance**: Format rich responses with visual indicators
5. **Document**: Update tool help, metadata, guidance
6. **Test**: Manual testing with various scenarios
7. **Polish**: Refine recommendations and suggestions
8. **Document**: Create implementation summary

### Backwards Compatibility
- ✅ Keep existing `find_files`, `read_file`, `read_file_by_id` tools
- ✅ `get_files` is additive (doesn't break existing workflows)
- ✅ Existing tool descriptions updated to reference new tool
- ✅ No changes to existing function signatures

---

## 📝 ADDITIONAL ENHANCEMENTS (Future)

### Phase 2 Features (Post-MVP)
1. **Smart File Analysis**
   - Detect file relationships (syllabus → assignments → rubrics)
   - Identify lecture series (numbered files)
   - Group by topic/week automatically

2. **Batch Processing**
   - Process multiple files in sequence
   - Aggregate results
   - Generate comparative summaries

3. **File Comparisons**
   - Compare different versions
   - Highlight changes
   - Track file history

4. **Advanced Filters**
   - By author/uploader
   - By usage rights
   - By module reference
   - By assignment association

5. **Download Management**
   - Track downloaded files
   - Cache management UI
   - Processing history

---

## 🎯 IMPLEMENTATION CHECKLIST

### Core Development
- [ ] Create `lib/files-enhanced.ts`
  - [ ] `fetchFolderHierarchy()`
  - [ ] `fetchFilesWithMetadata()`
  - [ ] `categorizeFiles()`
  - [ ] `generateRecommendations()`
  - [ ] `formatFileResponse()`

- [ ] Create `tools/files-enhanced.ts`
  - [ ] `getFiles()` main function
  - [ ] Parameter validation
  - [ ] Course resolution
  - [ ] Folder resolution
  - [ ] Result formatting

### MCP Integration
- [ ] Register `get_files` tool in `mcp.ts`
- [ ] Implement handler with rich formatting
- [ ] Add visual indicators (emoji, formatting)
- [ ] Error handling with context
- [ ] Add metadata to responses

### Documentation
- [ ] Update `lib/tool-help.ts` with examples
- [ ] Update `lib/tool-metadata.ts` with category
- [ ] Update `lib/llm-guidance.ts` with workflows
- [ ] Create `FILE-ENHANCEMENT-SUMMARY.md`
- [ ] Update README.md

### Testing
- [ ] Test with empty courses
- [ ] Test with large file structures
- [ ] Test with various file types
- [ ] Test folder navigation
- [ ] Test filtering and sorting
- [ ] Test LlamaParse integration
- [ ] Test error scenarios

### Polish
- [ ] Optimize token usage
- [ ] Refine recommendations
- [ ] Improve visual hierarchy
- [ ] Add helpful tips
- [ ] Cross-reference with other tools

---

## 💡 KEY DESIGN PRINCIPLES

1. **Agentic First**: Tool should enable autonomous exploration
2. **Context Rich**: Always provide navigation and suggestions
3. **Processing Aware**: Always indicate LlamaParse capability
4. **Token Efficient**: Smart truncation, summary stats
5. **Visual Clarity**: Emoji indicators, clear hierarchy
6. **Error Resilient**: Graceful handling of missing data
7. **Backwards Compatible**: Enhance, don't replace existing tools

---

## 📚 RELATED DOCUMENTATION

- Canvas Files API: https://canvas.instructure.com/doc/api/files.html
- LlamaParse Documentation: https://docs.llamaindex.ai/en/stable/llama_cloud/llama_parse/
- Existing Implementation:
  - `tools/files.ts` - Current file search
  - `lib/llamaparse.ts` - Document processing
  - `lib/file-cache.ts` - Caching system
  - Enhanced modules: `MODULES-ENHANCEMENT-SUMMARY.md`
  - Enhanced pages: Page link extraction feature

---

## ✅ APPROVAL CHECKLIST

Before implementation, confirm:
- [ ] Plan addresses all user requirements
- [ ] Design is consistent with existing enhancements
- [ ] No breaking changes to existing tools
- [ ] LlamaParse integration is correct
- [ ] Token usage is optimized
- [ ] Error handling is comprehensive
- [ ] Documentation plan is complete

---

**Status**: 📋 PLAN COMPLETE - READY FOR REVIEW AND IMPLEMENTATION

**Estimated Implementation Time**: 4-5 hours total
- Phase 1 (Infrastructure): 1-2 hours
- Phase 2 (Tool Implementation): 1 hour
- Phase 3 (MCP Integration): 30 minutes
- Phase 4 (Documentation): 30 minutes
- Phase 5 (Display Logic): 1 hour
- Phase 6 (LlamaParse Integration): 30 minutes
- Testing & Polish: 30 minutes

**Next Step**: Review plan with user, get approval, then begin Phase 1 implementation
