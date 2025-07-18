import { Worker } from 'bullmq';
interface EmailNotificationData {
    type: 'email-notification';
    notification: {
        id: string;
        subscriptionId: string;
        changeType: string;
        resource: string;
        resourceData?: {
            id: string;
        };
        clientState: string;
        tenantId: string;
    };
    timestamp: string;
}
export declare const emailNotificationWorker: Worker<EmailNotificationData, any, string>;
export default emailNotificationWorker;
//# sourceMappingURL=email-notification.worker.d.ts.map