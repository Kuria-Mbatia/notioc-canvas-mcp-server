// LlamaParse Client Unit Tests

import { parseWithLlama, isFileSupported, getSupportedExtensions, LlamaParseOptions, ParseInput } from './llamaparse.js';

// Mock fetch globally
const originalFetch = global.fetch;

function mockFetch(responses: Array<{ url: RegExp; response: any; status?: number }>) {
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    const match = responses.find(r => r.url.test(url));
    if (!match) {
      throw new Error(`Unexpected fetch to: ${url}`);
    }
    
    return Promise.resolve({
      ok: (match.status || 200) < 400,
      status: match.status || 200,
      statusText: match.status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(match.response),
      text: () => Promise.resolve(typeof match.response === 'string' ? match.response : JSON.stringify(match.response))
    });
  });
}

function restoreFetch() {
  global.fetch = originalFetch;
}

describe('LlamaParse Client', () => {
  const validOptions: LlamaParseOptions = {
    apiKey: 'test-key',
    allowUpload: true,
    timeoutMs: 5000,
    pollIntervalMs: 100
  };

  const validInput: ParseInput = {
    buffer: Buffer.from('test content'),
    filename: 'test.pdf'
  };

  afterEach(() => {
    restoreFetch();
  });

  describe('File support validation', () => {
    test('should support PDF files', () => {
      expect(isFileSupported('document.pdf')).toBe(true);
    });

    test('should support Office documents', () => {
      expect(isFileSupported('document.docx')).toBe(true);
      expect(isFileSupported('presentation.pptx')).toBe(true);
      expect(isFileSupported('spreadsheet.xlsx')).toBe(true);
    });

    test('should support images', () => {
      expect(isFileSupported('image.jpg')).toBe(true);
      expect(isFileSupported('image.png')).toBe(true);
    });

    test('should support audio files', () => {
      expect(isFileSupported('audio.mp3')).toBe(true);
      expect(isFileSupported('audio.wav')).toBe(true);
    });

    test('should not support unsupported extensions', () => {
      expect(isFileSupported('file.xyz')).toBe(false);
      expect(isFileSupported('file.unknown')).toBe(false);
    });

    test('should return comprehensive extensions list', () => {
      const extensions = getSupportedExtensions();
      expect(extensions).toContain('pdf');
      expect(extensions).toContain('docx');
      expect(extensions).toContain('xlsx');
      expect(extensions).toContain('pptx');
      expect(extensions).toContain('jpg');
      expect(extensions).toContain('mp3');
      expect(extensions.length).toBeGreaterThan(50);
    });
  });

  describe('Input validation', () => {
    test('should reject when API key is missing', async () => {
      const options = { ...validOptions, apiKey: '' };
      
      await expect(parseWithLlama(validInput, options))
        .rejects
        .toMatchObject({
          code: 'DISABLED',
          message: 'LlamaParse disabled (no LLAMA_CLOUD_API_KEY)'
        });
    });

    test('should reject when upload is not allowed', async () => {
      const options = { ...validOptions, allowUpload: false };
      
      await expect(parseWithLlama(validInput, options))
        .rejects
        .toMatchObject({
          code: 'UPLOAD_DISALLOWED',
          message: 'File upload disabled (set LLAMA_PARSE_ALLOW_UPLOAD=true)'
        });
    });

    test('should reject unsupported file types', async () => {
      const input = { ...validInput, filename: 'test.xyz' };
      
      await expect(parseWithLlama(input, validOptions))
        .rejects
        .toMatchObject({
          code: 'UNSUPPORTED',
          message: 'Unsupported file type: .xyz'
        });
    });

    test('should reject files exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
      const input = { ...validInput, buffer: largeBuffer };
      const options = { ...validOptions, maxBytes: 50 * 1024 * 1024 };
      
      await expect(parseWithLlama(input, options))
        .rejects
        .toMatchObject({
          code: 'SIZE_EXCEEDED'
        });
    });

    test('should reject audio files exceeding 20MB', async () => {
      const largeBuffer = Buffer.alloc(25 * 1024 * 1024); // 25MB
      const input = { ...validInput, buffer: largeBuffer, filename: 'audio.mp3' };
      
      await expect(parseWithLlama(input, validOptions))
        .rejects
        .toMatchObject({
          code: 'SIZE_EXCEEDED',
          message: expect.stringContaining('Audio file exceeds 20MB limit')
        });
    });
  });

  describe('API interaction', () => {
    test('should successfully parse a document', async () => {
      mockFetch([
        {
          url: /\/api\/parsing\/upload$/,
          response: { id: 'job-123' }
        },
        {
          url: /\/api\/parsing\/job\/job-123$/,
          response: { status: 'SUCCESS', pages: 2 }
        },
        {
          url: /\/api\/parsing\/job\/job-123\/result\/markdown$/,
          response: '# Document Content\n\nParsed text here.'
        }
      ]);

      const result = await parseWithLlama(validInput, validOptions);

      expect(result).toMatchObject({
        content: '# Document Content\n\nParsed text here.',
        format: 'markdown',
        meta: {
          jobId: 'job-123',
          pages: 2,
          processingTime: expect.any(Number)
        }
      });
    });

    test('should handle upload failures', async () => {
      mockFetch([
        {
          url: /\/api\/parsing\/upload$/,
          response: { error: 'Invalid file' },
          status: 400
        }
      ]);

      await expect(parseWithLlama(validInput, validOptions))
        .rejects
        .toMatchObject({
          code: 'API_ERROR',
          message: expect.stringContaining('Upload failed: 400')
        });
    });

    test('should handle job failures', async () => {
      mockFetch([
        {
          url: /\/api\/parsing\/upload$/,
          response: { id: 'job-123' }
        },
        {
          url: /\/api\/parsing\/job\/job-123$/,
          response: { status: 'ERROR', error: 'Parse failed' }
        }
      ]);

      await expect(parseWithLlama(validInput, validOptions))
        .rejects
        .toMatchObject({
          code: 'API_ERROR',
          message: expect.stringContaining('Parse job failed: Parse failed')
        });
    });

    test('should handle timeouts', async () => {
      mockFetch([
        {
          url: /\/api\/parsing\/upload$/,
          response: { id: 'job-123' }
        },
        {
          url: /\/api\/parsing\/job\/job-123$/,
          response: { status: 'PROCESSING' }
        }
      ]);

      const options = { ...validOptions, timeoutMs: 200, pollIntervalMs: 50 };

      await expect(parseWithLlama(validInput, options))
        .rejects
        .toMatchObject({
          code: 'TIMEOUT',
          message: expect.stringContaining('Parse job timed out after 200ms')
        });
    });
  });
}); 