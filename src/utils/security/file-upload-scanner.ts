/**
 * Enhanced File Upload Security Scanner
 * Implements virus scanning, content analysis, and comprehensive file validation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';
import { logger } from '../logger.js';
import { PathValidator } from './path-validation.js';

const execAsync = promisify(exec);

interface FileScanResult {
  safe: boolean;
  threats: string[];
  warnings: string[];
  metadata: FileMetadata;
}

interface FileMetadata {
  size: number;
  mimeType: string;
  extension: string;
  hash: string;
  magicNumber?: string;
  embeddedFiles?: number;
  hasExecutable?: boolean;
  hasMacros?: boolean;
}

interface ScanOptions {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  blockedMimeTypes?: string[];
  allowedExtensions?: string[];
  blockedExtensions?: string[];
  scanForVirus?: boolean;
  deepScan?: boolean;
  quarantinePath?: string;
}

const DEFAULT_OPTIONS: ScanOptions = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  blockedMimeTypes: [
    'application/x-executable',
    'application/x-dosexec',
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-bat',
    'application/x-sh',
    'application/x-javascript',
    'text/javascript'
  ],
  blockedExtensions: [
    '.exe', '.dll', '.scr', '.bat', '.cmd', '.com', '.pif',
    '.js', '.vbs', '.vbe', '.jar', '.app', '.deb', '.rpm',
    '.msi', '.ps1', '.psm1', '.sh', '.bash', '.zsh'
  ],
  scanForVirus: true,
  deepScan: true
};

// Magic numbers for file type detection
const MAGIC_NUMBERS: { [key: string]: string[] } = {
  'image/jpeg': ['FFD8FF'],
  'image/png': ['89504E47'],
  'image/gif': ['47494638'],
  'image/webp': ['52494646'],
  'application/pdf': ['255044462D'],
  'application/zip': ['504B0304', '504B0506', '504B0708'],
  'application/x-rar': ['526172211A'],
  'application/x-7z-compressed': ['377ABCAF271C'],
  'application/vnd.ms-office': ['D0CF11E0A1B11AE1'],
  'application/vnd.openxmlformats': ['504B0304'],
  'text/html': ['3C68746D6C', '3C21444F4354595045'],
  'application/x-executable': ['4D5A'], // PE/COFF
  'application/x-elf': ['7F454C46'],
  'application/x-mach-binary': ['FEEDFACE', 'FEEDFACF', 'CEFAEDFE', 'CFFAEDFE']
};

// Patterns that might indicate malicious content
const MALICIOUS_PATTERNS = [
  // Script patterns
  /<script[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  
  // PHP patterns
  /<\?php/gi,
  /eval\s*\(/gi,
  /base64_decode/gi,
  
  // Shell patterns
  /\bsh\s+-c\s+/gi,
  /\bbash\s+-c\s+/gi,
  /\bexec\s+/gi,
  /\bsystem\s*\(/gi,
  
  // PowerShell patterns
  /powershell/gi,
  /invoke-expression/gi,
  /-encodedcommand/gi,
  
  // SQL patterns
  /union\s+select/gi,
  /drop\s+table/gi,
  /insert\s+into/gi,
  
  // EICAR test pattern
  /X5O!P%@AP\[4\\PZX54\(P\^\)7CC\)7\}\$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!\$H\+H\*/
];

export class FileUploadScanner {
  private options: ScanOptions;
  private pathValidator: PathValidator;

  constructor(options: ScanOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.pathValidator = new PathValidator({ strict: true });
  }

  /**
   * Comprehensive file scan
   */
  public async scanFile(
    filePath: string,
    originalName?: string
  ): Promise<FileScanResult> {
    const threats: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate file path
      const pathValidation = this.pathValidator.validatePath(filePath);
      if (!pathValidation.valid) {
        threats.push(`Invalid file path: ${pathValidation.error}`);
        return this.createResult(false, threats, warnings);
      }

      // Check file exists
      if (!fs.existsSync(filePath)) {
        threats.push('File does not exist');
        return this.createResult(false, threats, warnings);
      }

      // Get file stats
      const stats = fs.statSync(filePath);
      
      // Check file size
      const maxSize = this.options.maxFileSize || DEFAULT_OPTIONS.maxFileSize!;
      if (stats.size > maxSize) {
        threats.push(`File exceeds maximum size of ${maxSize} bytes`);
        return this.createResult(false, threats, warnings);
      }

      // Calculate file hash
      const fileHash = await this.calculateFileHash(filePath);

      // Get file metadata
      const metadata: FileMetadata = {
        size: stats.size,
        mimeType: '',
        extension: path.extname(originalName || filePath).toLowerCase(),
        hash: fileHash
      };

      // Check magic number
      const magicNumber = await this.getMagicNumber(filePath);
      metadata.magicNumber = magicNumber;

      // Detect MIME type from magic number
      metadata.mimeType = this.detectMimeType(magicNumber);

      // Validate extension matches content
      if (!this.validateExtensionMatch(metadata.extension, metadata.mimeType)) {
        threats.push('File extension does not match file content');
      }

      // Check blocked extensions
      const blockedExts = this.options.blockedExtensions || DEFAULT_OPTIONS.blockedExtensions || [];
      if (blockedExts.includes(metadata.extension)) {
        threats.push(`Blocked file extension: ${metadata.extension}`);
      }

      // Check blocked MIME types
      const blockedMimes = this.options.blockedMimeTypes || DEFAULT_OPTIONS.blockedMimeTypes || [];
      if (blockedMimes.includes(metadata.mimeType)) {
        threats.push(`Blocked MIME type: ${metadata.mimeType}`);
      }

      // Check for executable content
      if (this.isExecutable(magicNumber)) {
        metadata.hasExecutable = true;
        threats.push('File contains executable content');
      }

      // Deep content scan
      if (this.options.deepScan) {
        const contentThreats = await this.scanFileContent(filePath, metadata);
        threats.push(...contentThreats);
      }

      // Virus scan (if available)
      if (this.options.scanForVirus) {
        const virusThreats = await this.performVirusScan(filePath);
        threats.push(...virusThreats);
      }

      // Check for embedded files (archives)
      if (this.isArchive(metadata.mimeType)) {
        warnings.push('File is an archive - contents not fully scanned');
        metadata.embeddedFiles = await this.countArchiveFiles(filePath);
        
        if (metadata.embeddedFiles > 100) {
          threats.push('Archive contains excessive number of files');
        }
      }

      // Check for Office macros
      if (this.isOfficeDocument(metadata.mimeType)) {
        const hasMacros = await this.checkForMacros(filePath);
        if (hasMacros) {
          metadata.hasMacros = true;
          warnings.push('Document contains macros');
        }
      }

      // Determine if file is safe
      const safe = threats.length === 0;

      // Quarantine if dangerous
      if (!safe && this.options.quarantinePath) {
        await this.quarantineFile(filePath, this.options.quarantinePath);
      }

      return {
        safe,
        threats,
        warnings,
        metadata
      };

    } catch (error) {
      logger.error('File scan error', 'FILE_SCANNER', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
      threats.push('File scan failed');
      return this.createResult(false, threats, warnings);
    }
  }

  /**
   * Calculate file hash
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get file magic number
   */
  private async getMagicNumber(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, {
        start: 0,
        end: 8
      });
      
      let buffer = Buffer.alloc(0);
      
      stream.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
      });
      
      stream.on('end', () => {
        resolve(buffer.toString('hex').toUpperCase());
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Detect MIME type from magic number
   */
  private detectMimeType(magicNumber: string): string {
    for (const [mimeType, signatures] of Object.entries(MAGIC_NUMBERS)) {
      for (const signature of signatures) {
        if (magicNumber.startsWith(signature)) {
          return mimeType;
        }
      }
    }
    return 'application/octet-stream';
  }

  /**
   * Validate extension matches content
   */
  private validateExtensionMatch(extension: string, mimeType: string): boolean {
    const extensionMap: { [key: string]: string[] } = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.gif': ['image/gif'],
      '.pdf': ['application/pdf'],
      '.zip': ['application/zip', 'application/vnd.openxmlformats'],
      '.docx': ['application/vnd.openxmlformats'],
      '.xlsx': ['application/vnd.openxmlformats']
    };

    const expectedMimes = extensionMap[extension];
    if (!expectedMimes) return true; // Unknown extension, allow
    
    return expectedMimes.includes(mimeType);
  }

  /**
   * Check if file is executable
   */
  private isExecutable(magicNumber: string): boolean {
    const executableSignatures = ['4D5A', '7F454C46', 'FEEDFACE', 'FEEDFACF'];
    return executableSignatures.some(sig => magicNumber.startsWith(sig));
  }

  /**
   * Check if file is an archive
   */
  private isArchive(mimeType: string): boolean {
    return [
      'application/zip',
      'application/x-rar',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip'
    ].includes(mimeType);
  }

  /**
   * Check if file is an Office document
   */
  private isOfficeDocument(mimeType: string): boolean {
    return mimeType.includes('office') || mimeType.includes('document');
  }

  /**
   * Scan file content for malicious patterns
   */
  private async scanFileContent(
    filePath: string,
    metadata: FileMetadata
  ): Promise<string[]> {
    const threats: string[] = [];

    // Only scan text-based files
    if (!this.isTextBased(metadata.mimeType)) {
      return threats;
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      for (const pattern of MALICIOUS_PATTERNS) {
        if (pattern.test(content)) {
          threats.push(`Malicious pattern detected: ${pattern.source}`);
        }
      }

      // Check for suspicious entropy (might indicate encryption/obfuscation)
      const entropy = this.calculateEntropy(content);
      if (entropy > 7.5) {
        threats.push('High entropy detected - possible obfuscation');
      }

    } catch (error) {
      // File might not be text, ignore
    }

    return threats;
  }

  /**
   * Perform virus scan using ClamAV (if available)
   */
  private async performVirusScan(filePath: string): Promise<string[]> {
    const threats: string[] = [];

    try {
      // Check if ClamAV is installed
      await execAsync('which clamscan');
      
      // Run virus scan
      const { stdout, stderr } = await execAsync(`clamscan --no-summary "${filePath}"`);
      
      if (stderr) {
        logger.warn('Virus scan stderr', 'FILE_SCANNER', { stderr });
      }
      
      if (stdout.includes('FOUND')) {
        const matches = stdout.match(/(.+): (.+) FOUND/g);
        if (matches) {
          matches.forEach(match => {
            const threat = match.split(': ')[1].replace(' FOUND', '');
            threats.push(`Virus detected: ${threat}`);
          });
        }
      }
    } catch (error) {
      // ClamAV not installed or scan failed - log but don't fail
      logger.debug('ClamAV not available', 'FILE_SCANNER');
    }

    return threats;
  }

  /**
   * Count files in archive
   */
  private async countArchiveFiles(filePath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`unzip -l "${filePath}" | tail -1`);
      const match = stdout.match(/(\d+) files?/);
      return match ? parseInt(match[1]) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Check for macros in Office documents
   */
  private async checkForMacros(filePath: string): Promise<boolean> {
    try {
      // Simple check - look for vbaProject.bin in the file
      const { stdout } = await execAsync(`unzip -l "${filePath}" | grep -i vbaProject`);
      return stdout.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Calculate entropy of content
   */
  private calculateEntropy(content: string): number {
    const frequencies: { [key: string]: number } = {};
    
    for (const char of content) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = content.length;
    
    for (const freq of Object.values(frequencies)) {
      const p = freq / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  /**
   * Check if file is text-based
   */
  private isTextBased(mimeType: string): boolean {
    return mimeType.startsWith('text/') || 
           mimeType.includes('json') ||
           mimeType.includes('xml') ||
           mimeType.includes('javascript');
  }

  /**
   * Quarantine dangerous file
   */
  private async quarantineFile(
    filePath: string,
    quarantinePath: string
  ): Promise<void> {
    const filename = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantinedName = `${timestamp}_${filename}.quarantine`;
    const destination = path.join(quarantinePath, quarantinedName);

    await fs.promises.rename(filePath, destination);
    
    logger.warn('File quarantined', 'FILE_SCANNER', {
      original: filePath,
      quarantined: destination
    });
  }

  /**
   * Create scan result
   */
  private createResult(
    safe: boolean,
    threats: string[],
    warnings: string[],
    metadata?: FileMetadata
  ): FileScanResult {
    return {
      safe,
      threats,
      warnings,
      metadata: metadata || {
        size: 0,
        mimeType: '',
        extension: '',
        hash: ''
      }
    };
  }
}

// Export singleton instance
export const fileScanner = new FileUploadScanner();

// Export middleware for Express
export function fileScanMiddleware(options?: ScanOptions) {
  const scanner = new FileUploadScanner(options);
  
  return async (req: any, res: any, next: any): Promise<any> => {
    if (!req.files || req.files.length === 0) {
      return next();
    }

    const files = Array.isArray(req.files) ? req.files : [req.files];
    
    for (const file of files) {
      const scanResult = await scanner.scanFile(file.path, file.originalname);
      
      if (!scanResult.safe) {
        logger.warn('Dangerous file upload blocked', 'SECURITY', {
          filename: file.originalname,
          threats: scanResult.threats,
          ip: req.ip
        });
        
        // Delete the file
        try {
          await fs.promises.unlink(file.path);
        } catch (err) {
          logger.error('Failed to delete dangerous file', 'SECURITY', { 
            path: file.path,
            error: err 
          });
        }
        
        return res.status(400).json({
          error: 'File upload rejected',
          code: 'FILE_SECURITY_ERROR',
          threats: scanResult.threats
        });
      }
      
      // Attach scan result to file object for later use
      file.scanResult = scanResult;
    }
    
    next();
  };
}