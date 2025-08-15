/**
 * Grocery File Storage Manager - Handles file storage for grocery agent
 * Manages receipts, product images, meal plans, and other grocery-related files
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "../../utils/logger.js";
import appConfig from "../../config/app.config.js";

export interface FileMetadata {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: "receipt" | "product_image" | "meal_plan" | "recipe" | "other";
  userId?: string;
  relatedId?: string; // Could be session_id, list_id, etc.
  uploadedAt: Date;
  checksum: string;
  storagePath: string;
}

export interface ReceiptData {
  sessionId: string;
  orderNumber: string;
  storeLocation?: string;
  totalAmount: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  extractedAt?: Date;
}

export class GroceryFileStorage {
  private baseStoragePath: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB default

  // Allowed MIME types for different categories
  private allowedMimeTypes = {
    receipt: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
    product_image: ["image/jpeg", "image/png", "image/webp"],
    meal_plan: ["image/jpeg", "image/png", "application/pdf"],
    recipe: ["application/pdf", "text/plain", "text/markdown"],
    other: ["image/jpeg", "image/png", "application/pdf", "text/plain"],
  };

  constructor(baseStoragePath?: string) {
    this.baseStoragePath =
      baseStoragePath ||
      path.join(appConfig.storage?.basePath || "./storage", "grocery");
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    const directories = [
      "receipts",
      "product_images",
      "meal_plans",
      "recipes",
      "temp",
    ];

    for (const dir of directories) {
      const dirPath = path.join(this.baseStoragePath, dir);
      await fs.mkdir(dirPath, { recursive: true });
    }

    logger.info("Grocery file storage initialized", "GROCERY_STORAGE");
  }

  /**
   * Store a file
   */
  async storeFile(
    buffer: Buffer,
    originalName: string,
    category: FileMetadata["category"],
    metadata?: {
      userId?: string;
      relatedId?: string;
      mimeType?: string;
    },
  ): Promise<FileMetadata> {
    // Validate file size
    if (buffer?.length || 0 > this.maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`,
      );
    }

    // Determine MIME type
    const mimeType =
      metadata?.mimeType || this.detectMimeType(buffer, originalName);

    // Validate MIME type for category
    if (!this.allowedMimeTypes[category].includes(mimeType)) {
      throw new Error(
        `File type ${mimeType} not allowed for category ${category}`,
      );
    }

    // Generate file metadata
    const fileId = this.generateFileId();
    const fileExtension =
      path.extname(originalName) || this.getExtensionForMimeType(mimeType);
    const filename = `${fileId}${fileExtension}`;
    const categoryPath = this.getCategoryPath(category);
    const storagePath = path.join(categoryPath, filename);
    const fullPath = path.join(this.baseStoragePath, storagePath);

    // Calculate checksum
    const checksum = this.calculateChecksum(buffer);

    // Write file
    await fs.writeFile(fullPath, buffer);

    // Create metadata
    const fileMetadata: FileMetadata = {
      id: fileId,
      filename,
      originalName,
      mimeType,
      size: buffer?.length || 0,
      category,
      userId: metadata?.userId,
      relatedId: metadata?.relatedId,
      uploadedAt: new Date(),
      checksum,
      storagePath,
    };

    logger.info(
      `Stored file ${fileId} in category ${category}`,
      "GROCERY_STORAGE",
    );
    return fileMetadata;
  }

  /**
   * Retrieve a file
   */
  async getFile(
    fileId: string,
    category: FileMetadata["category"],
  ): Promise<{
    buffer: Buffer;
    metadata: Partial<FileMetadata>;
  }> {
    const files = await fs.readdir(
      path.join(this.baseStoragePath, this.getCategoryPath(category)),
    );
    const matchingFile = files.find((f: any) => f.startsWith(fileId));

    if (!matchingFile) {
      throw new Error(`File not found: ${fileId}`);
    }

    const filePath = path.join(
      this.baseStoragePath,
      this.getCategoryPath(category),
      matchingFile,
    );
    const buffer = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);

    return {
      buffer,
      metadata: {
        id: fileId,
        filename: matchingFile,
        size: stats.size,
        category,
      },
    };
  }

  /**
   * Store a receipt image and extract data
   */
  async storeReceipt(
    imageBuffer: Buffer,
    sessionId: string,
    userId: string,
    extractData: boolean = true,
  ): Promise<{
    fileMetadata: FileMetadata;
    receiptData?: ReceiptData;
  }> {
    // Store the receipt image
    const fileMetadata = await this.storeFile(
      imageBuffer,
      `receipt_${sessionId}.jpg`,
      "receipt",
      {
        userId,
        relatedId: sessionId,
      },
    );

    let receiptData: ReceiptData | undefined;

    if (extractData) {
      // In a real implementation, this would use OCR to extract receipt data
      // For now, returning mock data
      receiptData = {
        sessionId,
        orderNumber: `WM${Date.now()}`,
        storeLocation: "Walmart Supercenter #1234",
        totalAmount: 0,
        items: [],
        extractedAt: new Date(),
      };

      logger.info(
        `Receipt data extraction completed for session ${sessionId}`,
        "GROCERY_STORAGE",
      );
    }

    return { fileMetadata, receiptData };
  }

  /**
   * Store a product image
   */
  async storeProductImage(
    imageBuffer: Buffer,
    productId: string,
    imageType: "thumbnail" | "full" = "full",
  ): Promise<FileMetadata> {
    return await this.storeFile(
      imageBuffer,
      `product_${productId}_${imageType}.jpg`,
      "product_image",
      {
        relatedId: productId,
      },
    );
  }

  /**
   * Store a meal plan document
   */
  async storeMealPlan(
    documentBuffer: Buffer,
    planId: string,
    userId: string,
    format: "pdf" | "image" = "pdf",
  ): Promise<FileMetadata> {
    const extension = format === "pdf" ? ".pdf" : ".jpg";

    return await this.storeFile(
      documentBuffer,
      `meal_plan_${planId}${extension}`,
      "meal_plan",
      {
        userId,
        relatedId: planId,
      },
    );
  }

  /**
   * Generate a shopping list PDF
   */
  async generateShoppingListPDF(listData: {
    listName: string;
    items: Array<{
      name: string;
      quantity: number;
      unit: string;
      category?: string;
      estimatedPrice?: number;
    }>;
    totalEstimate?: number;
    userId: string;
    listId: string;
  }): Promise<FileMetadata> {
    // In a real implementation, this would use a PDF library to generate the document
    // For now, creating a simple text representation

    let content = `SHOPPING LIST: ${listData.listName}\n`;
    content += `Generated: ${new Date().toLocaleDateString()}\n\n`;

    // Group items by category
    const categories = new Map<string, typeof listData.items>();

    for (const item of listData.items) {
      const category = item.category || "Other";
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(item);
    }

    // Add items by category
    for (const [category, items] of categories) {
      content += `\n${category.toUpperCase()}\n`;
      content += "-".repeat(30) + "\n";

      for (const item of items) {
        const price = item.estimatedPrice
          ? `$${item?.estimatedPrice?.toFixed(2)}`
          : "";
        content += `[ ] ${item.name} - ${item.quantity} ${item.unit} ${price}\n`;
      }
    }

    if (listData.totalEstimate) {
      content += `\nESTIMATED TOTAL: $${listData?.totalEstimate?.toFixed(2)}\n`;
    }

    const buffer = Buffer.from(content, "utf-8");

    return await this.storeFile(
      buffer,
      `shopping_list_${listData.listId}.txt`,
      "other",
      {
        userId: listData.userId,
        relatedId: listData.listId,
        mimeType: "text/plain",
      },
    );
  }

  /**
   * Clean up old files
   */
  async cleanupOldFiles(daysOld: number = 90): Promise<number> {
    let deletedCount = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const categories = Object.keys(this.allowedMimeTypes) as Array<
      FileMetadata["category"]
    >;

    for (const category of categories) {
      const categoryPath = path.join(
        this.baseStoragePath,
        this.getCategoryPath(category),
      );

      try {
        const files = await fs.readdir(categoryPath);

        for (const file of files) {
          const filePath = path.join(categoryPath, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            deletedCount++;
            logger.info(`Deleted old file: ${file}`, "GROCERY_STORAGE");
          }
        }
      } catch (error) {
        logger.error(
          `Error cleaning up ${category}: ${error}`,
          "GROCERY_STORAGE",
        );
      }
    }

    logger.info(`Cleaned up ${deletedCount} old files`, "GROCERY_STORAGE");
    return deletedCount;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    byCategory: Record<string, { count: number; size: number }>;
  }> {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      byCategory: {} as Record<string, { count: number; size: number }>,
    };

    const categories = Object.keys(this.allowedMimeTypes) as Array<
      FileMetadata["category"]
    >;

    for (const category of categories) {
      const categoryPath = path.join(
        this.baseStoragePath,
        this.getCategoryPath(category),
      );
      let categoryCount = 0;
      let categorySize = 0;

      try {
        const files = await fs.readdir(categoryPath);

        for (const file of files) {
          const filePath = path.join(categoryPath, file);
          const fileStats = await fs.stat(filePath);

          categoryCount++;
          categorySize += fileStats.size;
        }
      } catch (error) {
        logger.warn(
          `Error reading ${category} directory: ${error}`,
          "GROCERY_STORAGE",
        );
      }

      stats.byCategory[category] = { count: categoryCount, size: categorySize };
      stats.totalFiles += categoryCount;
      stats.totalSize += categorySize;
    }

    return stats;
  }

  // Helper methods

  private generateFileId(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  private getCategoryPath(category: FileMetadata["category"]): string {
    const pathMap = {
      receipt: "receipts",
      product_image: "product_images",
      meal_plan: "meal_plans",
      recipe: "recipes",
      other: "temp",
    };
    return pathMap[category];
  }

  private detectMimeType(buffer: Buffer, filename: string): string {
    // Simple detection based on file extension
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".pdf": "application/pdf",
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".webp": "image/webp",
    };

    return mimeMap[ext] || "application/octet-stream";
  }

  private getExtensionForMimeType(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "application/pdf": ".pdf",
      "text/plain": ".txt",
      "text/markdown": ".md",
    };

    return extensionMap[mimeType] || ".bin";
  }
}

// Export singleton instance
let groceryFileStorage: GroceryFileStorage | null = null;

export function getGroceryFileStorage(): GroceryFileStorage {
  if (!groceryFileStorage) {
    groceryFileStorage = new GroceryFileStorage();
  }
  return groceryFileStorage;
}
