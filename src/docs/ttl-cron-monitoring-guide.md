# TTL Cron Job Monitoring and Prevention Guide

## Overview

This guide explains how to prevent TTL (Time To Live) cron job failures and provides comprehensive monitoring tools to ensure expired listings are automatically deleted as expected.

## The Problem

The TTL cron job (`/api/cron/cleanup-ttl-listings`) is scheduled to run every 2 hours at :15 minutes past even hours (00:15, 02:15, 04:15, etc.). However, it may fail to execute properly due to:

1. **Vercel Cron Job Issues**: The cron job may not be triggered by Vercel's infrastructure
2. **Authentication Problems**: The cron job may fail authentication checks
3. **Execution Timeouts**: The cleanup process may exceed Vercel's 60-second limit
4. **Database Connection Issues**: Firebase Admin SDK connection problems
5. **Silent Failures**: The cron job runs but fails silently without proper error reporting

## Prevention Measures Implemented

### 1. Enhanced Cron Job with Comprehensive Logging

**File**: `src/pages/api/cron/cleanup-ttl-listings.ts`

**Improvements**:
- Detailed execution metrics and timing
- Authentication method tracking
- Comprehensive error logging with stack traces
- Performance monitoring (listings per second)
- Alert system for significantly overdue listings (>2.5 hours)
- Execution time limits to prevent timeouts

### 2. Health Monitoring System

**File**: `src/pages/api/admin/monitor-ttl-cron.ts`

**Features**:
- Real-time health status assessment (healthy/warning/critical)
- Detection of overdue listings by severity:
  - Warning: 1+ hours overdue
  - Critical: 3+ hours overdue
- Next/last expected cron execution time calculation
- Detailed recommendations for fixing issues
- Comprehensive metrics and debugging information

### 3. Backup Cleanup Mechanism

**File**: `src/pages/api/admin/backup-ttl-cleanup.ts`

**Capabilities**:
- Emergency cleanup for critically overdue listings (3+ hours)
- Full backup cleanup with safety limits (max 50 deletions)
- Configurable deletion limits to prevent accidental mass deletions
- Detailed reporting of cleanup actions
- Automatic recommendations based on cleanup results

### 4. Admin Dashboard Integration

**Location**: `/admin/` → API Endpoints section

**New Tools**:
- **Monitor TTL Cron Health**: Check system status and detect issues
- **Emergency TTL Cleanup**: Quick fix for critically overdue listings
- **Full Backup TTL Cleanup**: Comprehensive cleanup with safety limits
- **Manual TTL Cleanup**: Direct execution of the main cron job logic

## Monitoring Workflow

### Daily Monitoring (Recommended)

1. **Check Cron Health**:
   ```
   GET /api/admin/monitor-ttl-cron
   Authorization: Bearer {ADMIN_SECRET}
   ```

2. **Interpret Results**:
   - **Healthy**: No expired listings found
   - **Warning**: 1+ hour overdue listings detected
   - **Critical**: 3+ hour overdue listings detected

3. **Take Action Based on Status**:
   - **Warning**: Monitor next cron execution
   - **Critical**: Run emergency cleanup immediately

### Emergency Response

When the monitoring system detects critical issues:

1. **Immediate Action**: Run Emergency TTL Cleanup
   ```
   POST /api/admin/backup-ttl-cleanup
   {
     "emergencyOnly": true,
     "reason": "admin_emergency",
     "maxDeletions": 20
   }
   ```

2. **Investigation**: Check Vercel cron job logs
3. **Full Cleanup**: If needed, run full backup cleanup
4. **Root Cause Analysis**: Investigate why the main cron job failed

## Alerting and Notifications

### Built-in Alerts

The enhanced cron job automatically logs warnings when:
- Listings are >2.5 hours overdue
- Multiple batches are required for cleanup
- Execution approaches time limits
- Authentication issues occur

### Recommended External Monitoring

Consider implementing:
1. **Log Monitoring**: Set up alerts on Vercel function logs for TTL cleanup failures
2. **Health Check Endpoint**: Regular automated calls to the monitoring endpoint
3. **Email Notifications**: Integrate with the monitoring system to send alerts
4. **Dashboard Widgets**: Display TTL health status on admin dashboard

## Troubleshooting Common Issues

### Issue 1: Cron Job Not Executing

**Symptoms**: No logs from cron job, listings accumulating
**Solutions**:
1. Verify `vercel.json` cron configuration
2. Check Vercel project settings for cron jobs
3. Ensure `CRON_SECRET` environment variable is set
4. Run manual cleanup as backup

### Issue 2: Authentication Failures

**Symptoms**: 401 errors in cron job logs
**Solutions**:
1. Verify `CRON_SECRET` matches between Vercel and code
2. Check `ADMIN_SECRET` for manual executions
3. Ensure Firebase Admin SDK credentials are valid

### Issue 3: Execution Timeouts

**Symptoms**: Cron job stops mid-execution, partial cleanup
**Solutions**:
1. Reduce `BATCH_SIZE` in cron job configuration
2. Implement pagination for large cleanup operations
3. Use backup cleanup tools for immediate relief

### Issue 4: Database Connection Issues

**Symptoms**: Firebase connection errors, failed queries
**Solutions**:
1. Verify Firebase Admin SDK configuration
2. Check Firestore security rules
3. Monitor Firebase quota usage
4. Implement connection retry logic

## Best Practices

### 1. Regular Monitoring
- Check TTL health status daily
- Monitor Vercel function logs weekly
- Review cleanup metrics monthly

### 2. Proactive Maintenance
- Run backup cleanup during maintenance windows
- Test cron job logic manually before deployments
- Keep cleanup tools readily available

### 3. Documentation
- Document any manual interventions
- Track patterns in cron job failures
- Maintain runbooks for common issues

### 4. Safety Measures
- Always use deletion limits in backup tools
- Test cleanup logic in staging environment
- Maintain database backups before major cleanups

## Configuration Reference

### Environment Variables
```
CRON_SECRET=your_cron_secret_here
ADMIN_SECRET=your_admin_secret_here
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

### Vercel Cron Configuration
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-ttl-listings",
      "schedule": "15 */2 * * *"
    }
  ]
}
```

### TTL Configuration
```typescript
export const LISTING_TTL_CONFIG: TTLConfig = {
  ttlField: 'deleteAt',
  gracePeriod: 24 * 60 * 60 * 1000, // 24 hours
  archiveDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```

## API Reference

### Monitor TTL Cron Health
```
GET /api/admin/monitor-ttl-cron
Authorization: Bearer {ADMIN_SECRET}

Response:
{
  "status": "healthy|warning|critical",
  "metrics": {
    "totalExpiredListings": 0,
    "oldestExpiredMinutes": null,
    "criticallyOverdueCount": 0,
    "warningOverdueCount": 0
  },
  "recommendations": [],
  "nextCronExpected": "2025-08-12T04:15:00.000Z"
}
```

### Emergency TTL Cleanup
```
POST /api/admin/backup-ttl-cleanup
Authorization: Bearer {ADMIN_SECRET}
Content-Type: application/json

{
  "emergencyOnly": true,
  "reason": "admin_emergency",
  "maxDeletions": 20
}

Response:
{
  "deletedCount": 2,
  "emergencyCount": 2,
  "recommendations": ["Emergency listings found - investigate main cron job failure"]
}
```

### Manual TTL Cleanup
```
POST /api/admin/manual-ttl-cleanup
Authorization: Bearer {ADMIN_SECRET}

Response:
{
  "deletedCount": 5,
  "deletedListings": [...],
  "metrics": {...},
  "success": true
}
```

## Conclusion

This comprehensive monitoring and backup system ensures that TTL cleanup failures are:
1. **Detected quickly** through health monitoring
2. **Resolved immediately** through backup cleanup tools
3. **Prevented in the future** through enhanced logging and alerting
4. **Documented thoroughly** for troubleshooting and maintenance

Regular use of these tools will maintain system health and prevent the accumulation of expired listings that should have been automatically deleted.