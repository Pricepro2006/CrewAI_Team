import { z } from "zod";
import { router, publicProcedure } from "../trpc/router.js";
import type { Router } from "@trpc/server";
import multer from "multer";
import { logger } from "../../utils/logger.js";

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Max 10 files at once
  },
  fileFilter: (_req, file, cb) => {
    // Accept only specific file types for document processing
    const allowedTypes = [
      "text/plain",
      "text/markdown",
      "text/html",
      "application/pdf",
      "application/json",
      "application/xml",
      "text/csv",
      "application/vnd.openxmlformats-officedocument?.wordprocessingml?.document",
      "application/vnd.openxmlformats-officedocument?.spreadsheetml?.sheet",
    ];

    const allowedExtensions = [
      ".txt",
      ".md",
      ".html",
      ".pdf",
      ".json",
      ".xml",
      ".csv",
      ".docx",
      ".xlsx",
      ".log",
    ];

    const fileExtension =
      file?.originalname?.toLowerCase().match(/\.[^.]+$/)?.[0] || "";

    if (
      allowedTypes.includes(file.mimetype) ||
      allowedExtensions.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${file.mimetype}`));
    }
  },
});

// Middleware to handle file uploads in tRPC context
export const fileUploadMiddleware: ReturnType<typeof upload.single> =
  upload.single("file");
export const multiFileUploadMiddleware: ReturnType<typeof upload.array> =
  upload.array("files", 10);

export const ragRouter: Router<any> = router({
  // Upload a document
  upload: publicProcedure
    .input(
      z.object({
        filename: z.string(),
        content: z.string(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx?.ragSystem?.addDocument(input.content, {
        id: Date.now().toString(),
        title: input.filename,
        ...input.metadata,
      });

      return {
        success: true,
        message: "Document uploaded successfully",
      };
    }),

  // Search documents
  search: publicProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().min(1).max(50).default(5),
        filter: z.record(z.any()).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (input.filter) {
        return await ctx?.ragSystem?.searchWithFilter(
          input.query,
          input.filter,
          input.limit,
        );
      }

      return await ctx?.ragSystem?.search(input.query, input.limit);
    }),

  // Get document by ID
  getDocument: publicProcedure
    .input(
      z.object({
        documentId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const document = await ctx?.ragSystem?.getDocument(input.documentId);
      if (!document) {
        throw new Error("Document not found");
      }
      return document;
    }),

  // Delete a document
  delete: publicProcedure
    .input(
      z.object({
        documentId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx?.ragSystem?.deleteDocument(input.documentId);
      return { success: true };
    }),

  // List all documents
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().default(100),
        offset: z.number().default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      return await ctx?.ragSystem?.getAllDocuments(input.limit, input.offset);
    }),

  // Get RAG statistics
  stats: publicProcedure.query(async ({ ctx }) => {
    const stats = await ctx?.ragSystem?.getStats();

    // Map the stats to match what the Dashboard expects
    return {
      ...stats,
      documentCount: stats.totalDocuments,
      chunksCount: stats.totalChunks,
    };
  }),

  // Clear all documents
  clear: publicProcedure.mutation(async ({ ctx }) => {
    await ctx?.ragSystem?.clear();
    return { success: true };
  }),

  // Export documents
  export: publicProcedure
    .input(
      z.object({
        format: z.enum(["json", "csv"]).default("json"),
      }),
    )
    .query(async ({ input, ctx }) => {
      const data = await ctx?.ragSystem?.exportDocuments(input.format);
      return {
        data,
        format: input.format,
        timestamp: new Date().toISOString(),
      };
    }),

  // Import documents
  import: publicProcedure
    .input(
      z.object({
        data: z.string(),
        format: z.enum(["json", "csv"]).default("json"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx?.ragSystem?.importDocuments(input.data, input.format);
      return {
        success: true,
        message: "Documents imported successfully",
      };
    }),

  // Upload file endpoint (base64 encoded for tRPC compatibility)
  uploadFile: publicProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
        data: z.string(), // Base64 encoded file data
        metadata: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Processing file upload", "RAG", {
          filename: input.filename,
          mimeType: input.mimeType,
          size: input?.data?.length,
        });

        // Decode base64 data
        const buffer = Buffer.from(input.data, "base64");
        const content = buffer.toString("utf-8");

        // Process the document
        const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await ctx?.ragSystem?.addDocument(content, {
          id: documentId,
          title: input.filename,
          mimeType: input.mimeType,
          uploadedAt: new Date().toISOString(),
          ...input.metadata,
        });

        logger.info("File uploaded successfully", "RAG", { documentId });

        return {
          success: true,
          documentId,
          message: "File uploaded and processed successfully",
        };
      } catch (error) {
        logger.error("File upload failed", "RAG", { error });
        throw new Error(
          `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }),

  // Batch upload files
  uploadBatch: publicProcedure
    .input(
      z.object({
        files: z
          .array(
            z.object({
              filename: z.string(),
              mimeType: z.string(),
              data: z.string(), // Base64 encoded
              metadata: z.record(z.any()).optional(),
            }),
          )
          .max(10),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const results = [];
      const errors = [];

      for (const file of input.files) {
        try {
          const buffer = Buffer.from(file.data, "base64");
          const content = buffer.toString("utf-8");
          const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          await ctx?.ragSystem?.addDocument(content, {
            id: documentId,
            title: file.filename,
            mimeType: file.mimeType,
            uploadedAt: new Date().toISOString(),
            ...file.metadata,
          });

          results.push({
            filename: file.filename,
            documentId,
            success: true,
          });
        } catch (error) {
          errors.push({
            filename: file.filename,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        success: errors?.length || 0 === 0,
        uploaded: results?.length || 0,
        failed: errors?.length || 0,
        results,
        errors,
      };
    }),

  // Process document from URL
  uploadFromUrl: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Processing document from URL", "RAG", { url: input.url });

        // Fetch content from URL
        const response = await fetch(input.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const content = await response.text();
        const filename = input?.url?.split("/").pop() || "document.txt";
        const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await ctx?.ragSystem?.addDocument(content, {
          id: documentId,
          title: filename,
          sourceUrl: input.url,
          uploadedAt: new Date().toISOString(),
          ...input.metadata,
        });

        return {
          success: true,
          documentId,
          message: "Document fetched and processed successfully",
        };
      } catch (error) {
        logger.error("URL document processing failed", "RAG", { error });
        throw new Error(
          `Failed to process URL: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }),

  // Update document metadata
  updateMetadata: publicProcedure
    .input(
      z.object({
        documentId: z.string(),
        metadata: z.record(z.any()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const document = await ctx?.ragSystem?.getDocument(input.documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      // Update metadata
      const updatedMetadata = {
        ...document.metadata,
        ...input.metadata,
        lastModified: new Date().toISOString(),
      };

      // Re-add document with updated metadata (since we can't update in-place)
      await ctx?.ragSystem?.deleteDocument(input.documentId);
      await ctx?.ragSystem?.addDocument(document.content, {
        ...updatedMetadata,
        id: input.documentId,
      });

      return {
        success: true,
        message: "Document metadata updated successfully",
      };
    }),

  // Email-specific RAG operations
  indexEmail: publicProcedure
    .input(
      z.object({
        emailId: z.string(),
        subject: z.string(),
        body: z.string(),
        sender: z.string().optional(),
        recipients: z.array(z.string()).optional(),
        date: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx?.ragSystem?.indexEmailContent(input.emailId, {
        subject: input.subject,
        body: input.body,
        sender: input.sender,
        recipients: input.recipients,
        date: input.date,
        metadata: input.metadata,
      });

      return {
        success: true,
        message: "Email indexed successfully",
        emailId: input.emailId,
      };
    }),

  // Batch index emails
  batchIndexEmails: publicProcedure
    .input(
      z.object({
        emails: z
          .array(
            z.object({
              id: z.string(),
              subject: z.string(),
              body: z.string(),
              sender: z.string().optional(),
              recipients: z.array(z.string()).optional(),
              date: z.string().optional(),
              metadata: z.record(z.any()).optional(),
            })
          )
          .max(1000), // Limit batch size
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx?.ragSystem?.batchIndexEmails(input.emails);

      return {
        success: result.failed === 0,
        indexed: result.indexed,
        failed: result.failed,
        errors: result.errors,
        message: `Batch indexing completed: ${result.indexed} indexed, ${result.failed} failed`,
      };
    }),

  // Search emails semantically
  searchEmails: publicProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().min(1).max(50).default(10),
        sender: z.string().optional(),
        dateRange: z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .optional(),
        includeBody: z.boolean().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      return await ctx?.ragSystem?.searchEmails(input.query, {
        limit: input.limit,
        sender: input.sender,
        dateRange: input.dateRange,
        includeBody: input.includeBody,
      });
    }),

  // Get email context for LLM enhancement
  getEmailContext: publicProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().min(1).max(20).default(5),
        focusArea: z.enum(['subject', 'body', 'both']).default('both'),
        timeframe: z.enum(['recent', 'all']).default('all'),
      }),
    )
    .query(async ({ input, ctx }) => {
      const context = await ctx?.ragSystem?.getEmailContext(input.query, {
        limit: input.limit,
        focusArea: input.focusArea,
        timeframe: input.timeframe,
      });

      return {
        context,
        hasContext: context.length > 0,
        length: context.length,
      };
    }),

  // Get email indexing statistics
  getEmailStats: publicProcedure.query(async ({ ctx }) => {
    const allDocs = await ctx?.ragSystem?.getAllDocuments(10000);
    const emailDocs = allDocs.filter((doc: any) => doc.metadata?.type === 'email');
    const ragStats = await ctx?.ragSystem?.getStats();

    return {
      totalDocuments: ragStats.totalDocuments,
      emailDocuments: emailDocs.length,
      nonEmailDocuments: ragStats.totalDocuments - emailDocs.length,
      averageChunksPerDocument: ragStats.averageChunksPerDocument,
      vectorStoreType: ragStats.vectorStoreType,
      embeddingModel: ragStats.embeddingModel,
      fallbackMode: ragStats.fallbackMode,
    };
  }),
});
