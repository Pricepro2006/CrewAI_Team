import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { logger } from "../../utils/logger.js";
import { MasterOrchestrator } from "../../core/master-orchestrator/MasterOrchestrator.js";
import ollamaConfig from "../../config/ollama.config.js";

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

// Initialize master orchestrator
let masterOrchestrator: MasterOrchestrator;

async function getOrchestrator() {
  if (!masterOrchestrator) {
    masterOrchestrator = new MasterOrchestrator({
      ollamaUrl: ollamaConfig.baseUrl,
      rag: {
        vectorStore: {
          type: "chromadb",
          path: "./data/chroma",
          collectionName: "crewai-knowledge",
          dimension: 384,
        },
        chunking: {
          size: 500,
          overlap: 50,
          method: "sentence",
        },
        retrieval: {
          topK: 5,
          minScore: 0.5,
          reranking: true,
        },
      },
    });
    await masterOrchestrator.initialize();
  }
  return masterOrchestrator;
}

const router: ReturnType<typeof Router> = Router();

// Single file upload endpoint
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      logger.info("Processing file upload", "UPLOAD", {
        filename: req?.file?.originalname,
        mimeType: req?.file?.mimetype,
        size: req?.file?.size,
      });

      const orchestrator = await getOrchestrator();
      const content = req?.file?.buffer.toString("utf-8");
      const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await orchestrator?.ragSystem?.addDocument(content, {
        id: documentId,
        title: req?.file?.originalname,
        mimeType: req?.file?.mimetype,
        uploadedAt: new Date().toISOString(),
        ...req?.body?.metadata, // Additional metadata from form
      });

      logger.info("File uploaded successfully", "UPLOAD", { documentId });

      return res.json({
        success: true,
        documentId,
        filename: req?.file?.originalname,
        size: req?.file?.size,
        message: "File uploaded and processed successfully",
      });
    } catch (error) {
      logger.error("File upload failed", "UPLOAD", { error });
      return res.status(500).json({
        error: "Upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Multiple file upload endpoint
router.post(
  "/upload/batch",
  upload.array("files", 10),
  async (req: Request, res: Response) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req?.files?.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      logger.info("Processing batch file upload", "UPLOAD", {
        count: req?.files?.length,
      });

      const orchestrator = await getOrchestrator();
      const results = [];
      const errors = [];

      for (const file of req.files) {
        try {
          const content = file?.buffer?.toString("utf-8");
          const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          await orchestrator?.ragSystem?.addDocument(content, {
            id: documentId,
            title: file.originalname,
            mimeType: file.mimetype,
            uploadedAt: new Date().toISOString(),
            ...req?.body?.metadata,
          });

          results.push({
            filename: file.originalname,
            documentId,
            size: file.size,
            success: true,
          });
        } catch (error) {
          errors.push({
            filename: file.originalname,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      logger.info("Batch upload completed", "UPLOAD", {
        uploaded: results?.length || 0,
        failed: errors?.length || 0,
      });

      return res.json({
        success: errors?.length || 0 === 0,
        uploaded: results?.length || 0,
        failed: errors?.length || 0,
        results,
        errors,
      });
    } catch (error) {
      logger.error("Batch upload failed", "UPLOAD", { error });
      return res.status(500).json({
        error: "Batch upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;
