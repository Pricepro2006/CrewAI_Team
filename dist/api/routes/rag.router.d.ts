import type { AnyRouter } from "@trpc/server";
import multer from "multer";
declare const upload: multer.Multer;
export declare const fileUploadMiddleware: ReturnType<typeof upload.single>;
export declare const multiFileUploadMiddleware: ReturnType<typeof upload.array>;
export declare const ragRouter: AnyRouter;
export {};
//# sourceMappingURL=rag.router.d.ts.map