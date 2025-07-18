import PQueue from 'p-queue';
import { EmailAnalysisAgent, EmailAnalysis } from '../agents/specialized/EmailAnalysisAgent';
import { EmailAnalysisCache } from '../cache/EmailAnalysisCache';
import { logger } from '../../utils/logger';
export class EmailBatchProcessor {
    queue;
    agent;
    cache;
    options;
    constructor(agent, cache, options) {
        this.agent = agent;
        this.cache = cache;
        this.options = {
            concurrency: options?.concurrency || 5,
            timeout: options?.timeout || 30000,
            useCaching: options?.useCaching !== false,
            retryAttempts: options?.retryAttempts || 2
        };
        this.queue = new PQueue({
            concurrency: this.options.concurrency,
            timeout: this.options.timeout,
            throwOnTimeout: true
        });
        logger.info('Email batch processor initialized', 'BATCH_PROCESSOR', {
            concurrency: this.options.concurrency,
            timeout: this.options.timeout,
            caching: this.options.useCaching
        });
    }
    /**
     * Process multiple emails in batch
     */
    async processBatch(emails) {
        const startTime = Date.now();
        const results = [];
        logger.info(`Starting batch processing of ${emails.length} emails`, 'BATCH_PROCESSOR');
        // Add all emails to the queue
        const promises = emails.map(email => this.queue.add(async () => {
            const result = await this.processEmail(email);
            results.push(result);
            return result;
        }));
        // Wait for all to complete
        await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const cacheHits = results.filter(r => r.fromCache).length;
        logger.info('Batch processing completed', 'BATCH_PROCESSOR', {
            total: emails.length,
            successful: successCount,
            failed: emails.length - successCount,
            cacheHits,
            totalTime: totalTime + 'ms',
            avgTime: Math.round(totalTime / emails.length) + 'ms'
        });
        return results;
    }
    /**
     * Process single email with caching and retry
     */
    async processEmail(email, attempt = 1) {
        const startTime = Date.now();
        try {
            // Check cache first
            if (this.options.useCaching) {
                const cached = this.cache.get(email.id);
                if (cached) {
                    return {
                        emailId: email.id,
                        success: true,
                        analysis: cached,
                        fromCache: true,
                        processingTime: Date.now() - startTime
                    };
                }
            }
            // Process email
            const analysis = await this.agent.analyzeEmail(email);
            // Cache the result
            if (this.options.useCaching) {
                this.cache.set(email.id, analysis);
            }
            return {
                emailId: email.id,
                success: true,
                analysis,
                fromCache: false,
                processingTime: Date.now() - startTime
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Retry logic
            if (attempt < this.options.retryAttempts) {
                logger.warn(`Retrying email ${email.id} (attempt ${attempt + 1})`, 'BATCH_PROCESSOR');
                return this.processEmail(email, attempt + 1);
            }
            logger.error(`Failed to process email ${email.id}`, 'BATCH_PROCESSOR', { error: errorMessage });
            return {
                emailId: email.id,
                success: false,
                error: errorMessage,
                processingTime: Date.now() - startTime
            };
        }
    }
    /**
     * Get queue statistics
     */
    getStats() {
        return {
            queue: {
                size: this.queue.size,
                pending: this.queue.pending,
                isPaused: this.queue.isPaused
            },
            cache: this.cache.getStats()
        };
    }
    /**
     * Pause processing
     */
    pause() {
        this.queue.pause();
        logger.info('Batch processor paused', 'BATCH_PROCESSOR');
    }
    /**
     * Resume processing
     */
    resume() {
        this.queue.start();
        logger.info('Batch processor resumed', 'BATCH_PROCESSOR');
    }
    /**
     * Clear the queue
     */
    clear() {
        this.queue.clear();
        logger.info('Batch processor queue cleared', 'BATCH_PROCESSOR');
    }
    /**
     * Process emails with optimized Graph API calls
     */
    async processWithGraphOptimization(emails, graphClient) {
        // Group emails by mailbox for batch fetching
        const emailsByMailbox = new Map();
        emails.forEach(email => {
            const mailbox = email.from?.emailAddress?.address || 'unknown';
            if (!emailsByMailbox.has(mailbox)) {
                emailsByMailbox.set(mailbox, []);
            }
            emailsByMailbox.get(mailbox).push(email);
        });
        const allResults = [];
        // Process each mailbox group
        for (const [mailbox, mailboxEmails] of emailsByMailbox) {
            try {
                // Use $select to fetch only needed fields
                const batchResponse = await graphClient
                    .api(`/users/${mailbox}/messages`)
                    .select('id,subject,body,bodyPreview,from,to,receivedDateTime,isRead,categories,importance')
                    .filter(`id in (${mailboxEmails.map(e => `'${e.id}'`).join(',')})`)
                    .top(mailboxEmails.length)
                    .get();
                // Process the batch
                const enrichedEmails = batchResponse.value;
                const batchResults = await this.processBatch(enrichedEmails);
                allResults.push(...batchResults);
            }
            catch (error) {
                logger.error(`Failed to fetch batch for mailbox ${mailbox}`, 'BATCH_PROCESSOR', { error });
                // Fallback to individual processing
                const fallbackResults = await this.processBatch(mailboxEmails);
                allResults.push(...fallbackResults);
            }
        }
        return allResults;
    }
}
//# sourceMappingURL=EmailBatchProcessor.js.map