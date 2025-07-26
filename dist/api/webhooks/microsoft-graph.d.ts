import type { Request, Response } from "express";
export declare const graphWebhookHandler: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const graphWebhookRoutes: {
    path: string;
    handler: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    method: string;
};
//# sourceMappingURL=microsoft-graph.d.ts.map