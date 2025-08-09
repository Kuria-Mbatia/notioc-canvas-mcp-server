/**
 * Web Interface Discovery Engine
 * Discovers Canvas course content via web interface when APIs are restricted
 */

import { logger } from './logger.js';
import { parseCanvasURL, extractFileIdsFromHTML, extractLinksFromHTML } from './url-processor.js';
import { 
  DiscoveredPage, 
  DiscoveredFile, 
  DiscoveredLink, 
  COMMON_COURSE_PAGES,
  DiscoveryError 
} from './course-discovery.js';

export interface WebDiscoveryOptions {
  maxPages: number;
  timeout: number;
  includeNavigation: boolean;
  extractEmbeddedContent: boolean;
  respectRateLimit: boolean;
}

export interface WebDiscoveryResult {
  courseId: string;
  success: boolean;
  discoveredPages: DiscoveredPage[];
  discoveredFiles: DiscoveredFile[];
  discoveredLinks: DiscoveredLink[];
  searchableContent: string;
  errors: string[];
  warnings: string[];
  timing: {
    totalTime: number;
    pagesDiscovered: number;
    filesExtracted: number;
    linksExtracted: number;
  };
}

const DEFAULT_OPTIONS: WebDiscoveryOptions = {
  maxPages: 20,
  timeout: 30000, // 30 seconds
  includeNavigation: true,
  extractEmbeddedContent: true,
  respectRateLimit: true
};

/**
 * Discover course content via web interface
 */
export async function discoverCourseContentViaWeb(
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
  options: Partial<WebDiscoveryOptions> = {}
): Promise<WebDiscoveryResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  logger.info(`[Web Discovery] Starting web discovery for course ${courseId}`);
  
  const result: WebDiscoveryResult = {
    courseId,
    success: false,
    discoveredPages: [],
    discoveredFiles: [],
    discoveredLinks: [],
    searchableContent: '',
    errors: [],
    warnings: [],
    timing: {
      totalTime: 0,
      pagesDiscovered: 0,
      filesExtracted: 0,
      linksExtracted: 0
    }
  };
  
  try {
    // Step 1: Discover course navigation structure
    if (opts.includeNavigation) {
      const navigation = await discoverCourseNavigation(courseId, canvasBaseUrl, accessToken);
      if (navigation.pages.length > 0) {
        result.discoveredPages.push(...navigation.pages);
        logger.info(`[Web Discovery] Found ${navigation.pages.length} pages via navigation`);
      }
    }
    
    // Step 2: Try common course page patterns
    const commonPages = await discoverCommonPages(courseId, canvasBaseUrl, accessToken, opts);
    
    // Merge with navigation results (avoid duplicates)
    commonPages.forEach(page => {
      if (!result.discoveredPages.some(existing => existing.url === page.url)) {
        result.discoveredPages.push(page);
      }
    });
    
    logger.info(`[Web Discovery] Total discovered pages: ${result.discoveredPages.length}`);
    
    // Step 3: Extract embedded content from accessible pages
    if (opts.extractEmbeddedContent) {
      for (const page of result.discoveredPages) {
        if (page.accessible && page.url) {
          try {
            const contentResult = await extractContentFromPage(page, canvasBaseUrl, accessToken);
            
            if (contentResult.files.length > 0) {
              result.discoveredFiles.push(...contentResult.files);
              page.embeddedFiles = contentResult.files;
            }
            
            if (contentResult.links.length > 0) {
              result.discoveredLinks.push(...contentResult.links);
              page.embeddedLinks = contentResult.links;
            }
            
            // Add to searchable content
            if (contentResult.textContent) {
              result.searchableContent += `\n\n${page.name}:\n${contentResult.textContent}`;
            }
            
            // Rate limiting
            if (opts.respectRateLimit) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.warnings.push(`Failed to extract content from ${page.name}: ${errorMsg}`);
            logger.warn(`[Web Discovery] Content extraction failed for ${page.name}: ${errorMsg}`);
          }
        }
      }
    }
    
    // Step 4: Build summary
    result.timing.totalTime = Date.now() - startTime;
    result.timing.pagesDiscovered = result.discoveredPages.length;
    result.timing.filesExtracted = result.discoveredFiles.length;
    result.timing.linksExtracted = result.discoveredLinks.length;
    result.success = result.discoveredPages.length > 0 || result.discoveredFiles.length > 0;
    
    logger.info(`[Web Discovery] Completed for course ${courseId}: ${result.timing.pagesDiscovered} pages, ${result.timing.filesExtracted} files, ${result.timing.linksExtracted} links in ${result.timing.totalTime}ms`);
    
    return result;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Web discovery failed: ${errorMsg}`);
    result.timing.totalTime = Date.now() - startTime;
    logger.error(`[Web Discovery] Failed for course ${courseId}: ${errorMsg}`);
    return result;
  }
}

/**
 * Discover course navigation structure
 */
async function discoverCourseNavigation(
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string
): Promise<{ pages: DiscoveredPage[], navigationLinks: string[] }> {
  try {
    logger.debug(`[Web Discovery] Discovering navigation for course ${courseId}`);
    
    // Try to get course tabs/navigation
    const tabsUrl = `${canvasBaseUrl}/api/v1/courses/${courseId}/tabs`;
    const response = await fetch(tabsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    const pages: DiscoveredPage[] = [];
    const navigationLinks: string[] = [];
    
    if (response.ok) {
      const tabs = await response.json();
      
      for (const tab of tabs) {
        if (tab.html_url && tab.visibility !== 'none') {
          const urlInfo = parseCanvasURL(tab.html_url);
          
          if (urlInfo.type === 'page' || tab.html_url.includes('/pages/')) {
            navigationLinks.push(tab.html_url);
            
            // Test if page is accessible
            const accessible = await isPageAccessible(tab.html_url, accessToken);
            
            pages.push({
              name: tab.label || tab.id,
              url: tab.html_url,
              path: urlInfo.resourceId || tab.id,
              accessible,
              contentType: 'html',
              lastChecked: new Date()
            });
          }
        }
      }
      
      logger.debug(`[Web Discovery] Found ${pages.length} navigation pages`);
    } else {
      logger.debug(`[Web Discovery] Navigation API failed: ${response.status}`);
    }
    
    return { pages, navigationLinks };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`[Web Discovery] Navigation discovery failed: ${errorMsg}`);
    return { pages: [], navigationLinks: [] };
  }
}

/**
 * Discover common course pages
 */
async function discoverCommonPages(
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
  options: WebDiscoveryOptions
): Promise<DiscoveredPage[]> {
  logger.debug(`[Web Discovery] Testing common page patterns for course ${courseId}`);
  
  const discoveredPages: DiscoveredPage[] = [];
  const testPromises = COMMON_COURSE_PAGES.slice(0, options.maxPages).map(pageName => 
    testCoursePage(courseId, canvasBaseUrl, accessToken, pageName)
  );
  
  try {
    const results = await Promise.allSettled(testPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        discoveredPages.push(result.value);
        logger.debug(`[Web Discovery] ✅ Found page: ${result.value.name}`);
      } else {
        logger.debug(`[Web Discovery] ❌ Page not found: ${COMMON_COURSE_PAGES[index]}`);
      }
    });
    
    return discoveredPages;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`[Web Discovery] Common page discovery failed: ${errorMsg}`);
    return discoveredPages;
  }
}

/**
 * Test if a specific course page exists and is accessible
 */
async function testCoursePage(
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
  pageName: string
): Promise<DiscoveredPage | null> {
  try {
    const url = `${canvasBaseUrl}/courses/${courseId}/pages/${pageName}`;
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.ok) {
      return {
        name: pageName.replace(/-/g, ' '),
        url,
        path: pageName,
        accessible: true,
        contentType: 'html',
        lastChecked: new Date()
      };
    }
    
    return null;
    
  } catch (error) {
    return null;
  }
}

/**
 * Check if a page URL is accessible
 */
async function isPageAccessible(url: string, accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Extract content from a discovered page
 */
async function extractContentFromPage(
  page: DiscoveredPage,
  canvasBaseUrl: string,
  accessToken: string
): Promise<{
  files: DiscoveredFile[];
  links: DiscoveredLink[];
  textContent: string;
}> {
  try {
    logger.debug(`[Web Discovery] Extracting content from ${page.name}`);
    
    // Try API first (more reliable than web interface)
    const apiUrl = `${canvasBaseUrl}/api/v1/courses/${page.url.match(/\/courses\/(\d+)/)?.[1]}/pages/${page.path}`;
    
    let html: string;
    
    try {
      const apiResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (apiResponse.ok) {
        const pageData = await apiResponse.json();
        html = pageData.body || '';
        logger.debug(`[Web Discovery] Got content via API for ${page.name} (${html.length} chars)`);
      } else {
        throw new Error(`API failed: ${apiResponse.status}`);
      }
    } catch (apiError) {
      // Fallback to web interface
      logger.debug(`[Web Discovery] API failed for ${page.name}, trying web interface`);
      
      const response = await fetch(page.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'text/html'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Web interface failed: ${response.status}`);
      }
      
      html = await response.text();
      
      // Check if we got a login redirect
      if (html.includes('Sign in to your account') || html.includes('Microsoft Corporation')) {
        throw new Error('Web interface requires additional authentication');
      }
    }
    
    // Extract files
    const fileMatches = extractFileIdsFromHTML(html, canvasBaseUrl);
    const files: DiscoveredFile[] = [];
    
    // Enhance file info with actual filenames from API
    for (const match of fileMatches) {
      let actualFileName = match.fileName;
      
      // Try to get real filename from Files API
      try {
        const fileApiUrl = `${canvasBaseUrl}/api/v1/files/${match.fileId}`;
        const fileResponse = await fetch(fileApiUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });
        
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          actualFileName = fileData.filename || fileData.display_name || match.fileName;
          logger.debug(`[Web Discovery] Enhanced file ${match.fileId}: "${match.fileName}" → "${actualFileName}"`);
        }
      } catch (error) {
        // Keep original name if API fails
        logger.debug(`[Web Discovery] Could not enhance file ${match.fileId}, keeping: "${match.fileName}"`);
      }
      
      files.push({
        fileId: match.fileId,
        fileName: actualFileName,
        url: match.url,
        source: page.name,
        lastModified: new Date()
      });
    }
    
    // Extract links
    const linkMatches = extractLinksFromHTML(html);
    const links: DiscoveredLink[] = linkMatches.map(match => ({
      title: match.title,
      url: match.url,
      type: match.type as 'external' | 'internal' | 'video' | 'document',
      source: page.name
    }));
    
    // Extract text content for search
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    logger.debug(`[Web Discovery] Extracted ${files.length} files and ${links.length} links from ${page.name}`);
    
    return { files, links, textContent };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`[Web Discovery] Content extraction failed for ${page.name}: ${errorMsg}`);
    return { files: [], links: [], textContent: '' };
  }
}

/**
 * Search discovered content by query
 */
export function searchDiscoveredContent(
  discovery: WebDiscoveryResult,
  query: string
): {
  files: DiscoveredFile[];
  pages: DiscoveredPage[];
  links: DiscoveredLink[];
  relevanceScore: number;
} {
  const queryLower = query.toLowerCase();
  const searchTerms = queryLower.split(/\s+/);
  
  // Search files
  const matchingFiles = discovery.discoveredFiles.filter(file => {
    const searchText = `${file.fileName} ${file.source}`.toLowerCase();
    return searchTerms.some(term => searchText.includes(term));
  });
  
  // Search pages
  const matchingPages = discovery.discoveredPages.filter(page => {
    const searchText = `${page.name} ${page.path}`.toLowerCase();
    return searchTerms.some(term => searchText.includes(term));
  });
  
  // Search links
  const matchingLinks = discovery.discoveredLinks.filter(link => {
    const searchText = `${link.title} ${link.source}`.toLowerCase();
    return searchTerms.some(term => searchText.includes(term));
  });
  
  // Calculate relevance score
  const totalMatches = matchingFiles.length + matchingPages.length + matchingLinks.length;
  const totalContent = discovery.discoveredFiles.length + discovery.discoveredPages.length + discovery.discoveredLinks.length;
  const relevanceScore = totalContent > 0 ? totalMatches / totalContent : 0;
  
  return {
    files: matchingFiles,
    pages: matchingPages,
    links: matchingLinks,
    relevanceScore
  };
} 