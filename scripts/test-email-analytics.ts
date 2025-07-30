import { EmailAnalyticsService } from '../src/core/database/EmailAnalyticsService';

async function testEmailAnalytics() {
  console.log('Testing EmailAnalyticsService...\n');
  
  const service = new EmailAnalyticsService();
  
  try {
    const stats = await service.getStats();
    
    console.log('Email Statistics:');
    console.log('================');
    console.log(`Total Emails: ${stats.totalEmails.toLocaleString()}`);
    console.log(`Processed Emails: ${stats.processedEmails.toLocaleString()}`);
    console.log(`Pending Emails: ${stats.pendingEmails.toLocaleString()}`);
    console.log(`Average Processing Time: ${stats.averageProcessingTime.toFixed(2)}ms`);
    console.log(`Timestamp: ${stats.timestamp.toISOString()}`);
    
    console.log('\nTest passed! ✅');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    service.close();
  }
}

testEmailAnalytics();