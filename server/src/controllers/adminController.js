const AdminService = require('../services/adminService');
const SearchService = require('../services/searchService');
const { formatSuccess, formatError, formatPaginatedResponse } = require('../utils/responseFormatter');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const {
  getTurnstileEnabled,
  setTurnstileEnabled,
  getChatbotEnabled,
  setChatbotEnabled,
} = require('../services/featureFlagService');

/**
 * Admin Controller
 * Handles all admin-related operations
 */
class AdminController {
  /**
   * Get all users with pagination and filtering
   */
  static async getUsers(req, res) {
    try {
      const result = await AdminService.getUsers(req.query);
      res.json(formatPaginatedResponse(
        result.users,
        result.pagination.currentPage,
        result.pagination.itemsPerPage,
        result.pagination.totalItems,
        'Users retrieved successfully'
      ));
    } catch (error) {
      logger.error('Error fetching users:', error);
      res.status(500).json(formatError('Failed to fetch users', error.message));
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(req, res) {
    try {
      const forceRefresh = String(req.query.forceRefresh || '').toLowerCase();
      const stats = await AdminService.getUserStats({ forceRefresh: forceRefresh === 'true' || forceRefresh === '1' });
      res.json(formatSuccess(stats, 'User statistics retrieved successfully'));
    } catch (error) {
      res.status(500).json(formatError('Failed to fetch user statistics', error.message));
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(req, res) {
    try {
      const user = await AdminService.getUserById(req.params.id);
      
      if (!user) {
        return res.status(404).json(formatError('User not found', 404));
      }

      res.json(formatSuccess(user, 'User retrieved successfully'));
    } catch (error) {
      res.status(500).json(formatError('Failed to fetch user', error.message));
    }
  }

  /**
   * Update user status (activate/deactivate)
   */
  static async updateUserStatus(req, res) {
    try {
      const { isActive, reasonTemplateKey } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json(formatError('isActive must be a boolean', 400));
      }

      if (!isActive && !reasonTemplateKey) {
        return res.status(400).json(formatError('reasonTemplateKey is required when deactivating a user', 400));
      }

      const user = await AdminService.updateUserStatus(req.params.id, isActive, {
        reasonTemplateKey,
        actorUserId: req.user?._id,
      });

      if (!user) {
        return res.status(404).json(formatError('User not found', 404));
      }

      res.json(formatSuccess(user, `User ${isActive ? 'activated' : 'deactivated'} successfully`));
    } catch (error) {
      if (error.message === 'Invalid reasonTemplateKey') {
        return res.status(400).json(formatError('Invalid reasonTemplateKey', 400));
      }
      if (error.message === 'You cannot deactivate your own account') {
        return res.status(403).json(formatError(error.message, 403));
      }
      if (error.message === 'Cannot deactivate the last active admin') {
        return res.status(409).json(formatError(error.message, 409));
      }
      res.status(500).json(formatError('Failed to update user status', error.message));
    }
  }

  /**
   * Batch update user status
   */
  static async batchUpdateUserStatus(req, res) {
    try {
      const { userIds, isActive, reasonTemplateKey } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json(formatError('userIds must be a non-empty array', 400));
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json(formatError('isActive must be a boolean', 400));
      }

      if (!isActive && !reasonTemplateKey) {
        return res.status(400).json(formatError('reasonTemplateKey is required when deactivating users', 400));
      }

      const result = await AdminService.batchUpdateUserStatus(userIds, isActive, { reasonTemplateKey });
      res.json(formatSuccess(result, `${result.modifiedCount} users ${isActive ? 'activated' : 'deactivated'} successfully`));
    } catch (error) {
      if (error.message === 'Invalid reasonTemplateKey') {
        return res.status(400).json(formatError('Invalid reasonTemplateKey', 400));
      }
      if (error.message === 'Cannot deactivate the last active admin') {
        return res.status(409).json(formatError(error.message, 409));
      }
      res.status(500).json(formatError('Failed to batch update user status', error.message));
    }
  }

  static async getUserStatusEmailTemplates(req, res) {
    try {
      const templates = AdminService.getUserStatusEmailTemplates();
      res.json(formatSuccess(templates, 'User status email templates retrieved successfully'));
    } catch (error) {
      res.status(500).json(formatError('Failed to fetch user status email templates', error.message));
    }
  }

  /**
   * Update user role
   */
  static async updateUserRole(req, res) {
    try {
      const { role } = req.body;

      const user = await AdminService.updateUserRole(req.params.id, role, {
        actorUserId: req.user?._id,
      });

      if (!user) {
        return res.status(404).json(formatError('User not found', 404));
      }

      res.json(formatSuccess(user, 'User role updated successfully'));
    } catch (error) {
      if (error.message.startsWith('Invalid role')) {
        return res.status(400).json(formatError(error.message, 400));
      }
      if (error.message === 'You cannot change your own role') {
        return res.status(403).json(formatError(error.message, 403));
      }
      if (error.message === 'Cannot change role for the last active admin') {
        return res.status(409).json(formatError(error.message, 409));
      }
      res.status(500).json(formatError('Failed to update user role', error.message));
    }
  }

  /**
   * Search users
   */
  static async searchUsers(req, res) {
    try {
      const { q: query } = req.query;
      const result = await AdminService.searchUsers(query, req.query);
      
      res.json(formatSuccess(result.users, 'Users search completed', {
        pagination: result.pagination
      }));
    } catch (error) {
      res.status(500).json(formatError('Failed to search users', error.message));
    }
  }

  /**
   * Get storage statistics
   */
  static async getStorageStats(req, res) {
    try {
      const forceRefresh = String(req.query.forceRefresh || '').toLowerCase();
      const storageData = await AdminService.getStorageStats({ forceRefresh: forceRefresh === 'true' || forceRefresh === '1' });
      res.json(formatSuccess(storageData, 'Storage statistics retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching storage stats:', error);
      res.status(500).json(formatError('Failed to fetch storage statistics', 500, error.message));
    }
  }

  // Herb Management Methods
  static async getHerbs(req, res) {
    try {
      const result = await AdminService.getHerbs(req.query);
      res.json(formatPaginatedResponse(
        result.herbs,
        result.pagination.currentPage,
        result.pagination.itemsPerPage,
        result.pagination.totalItems,
        'Herbs retrieved successfully'
      ));
    } catch (error) {
      logger.error('Error fetching herbs:', error);
      res.status(500).json(formatError('Failed to fetch herbs', error.message));
    }
  }

  static async getHerbStats(req, res) {
    try {
      const forceRefresh = String(req.query.forceRefresh || '').toLowerCase();
      const stats = await AdminService.getHerbStats({ forceRefresh: forceRefresh === 'true' || forceRefresh === '1' });
      res.json(formatSuccess(stats, 'Herb statistics retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching herb stats:', error);
      res.status(500).json(formatError('Failed to fetch herb statistics', error.message));
    }
  }

  static async getHerbById(req, res) {
    try {
      const herb = await AdminService.getHerbById(req.params.id);
      if (!herb) {
        return res.status(404).json(formatError('Herb not found', 404));
      }
      res.json(formatSuccess(herb, 'Herb retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching herb:', error);
      res.status(500).json(formatError('Failed to fetch herb', error.message));
    }
  }

  static async updateHerbStatus(req, res) {
    try {
      const { status } = req.body;
      const herb = await AdminService.updateHerbStatus(req.params.id, status);
      if (!herb) {
        return res.status(404).json(formatError('Herb not found', 404));
      }
      res.json(formatSuccess(herb, 'Herb status updated successfully'));
    } catch (error) {
      logger.error('Error updating herb status:', error);
      res.status(500).json(formatError('Failed to update herb status', error.message));
    }
  }

  static async batchUpdateHerbStatus(req, res) {
    try {
      const { ids, status } = req.body;
      const result = await AdminService.batchUpdateHerbStatus(ids, status);
      res.json(formatSuccess(result, 'Herb statuses updated successfully'));
    } catch (error) {
      logger.error('Error batch updating herb status:', error);
      res.status(500).json(formatError('Failed to batch update herb status', error.message));
    }
  }

  // Location Management Methods
  static async getLocations(req, res) {
    try {
      const result = await AdminService.getLocations(req.query);
      res.json(formatPaginatedResponse(
        result.locations,
        result.pagination.currentPage,
        result.pagination.itemsPerPage,
        result.pagination.totalItems,
        'Locations retrieved successfully'
      ));
    } catch (error) {
      logger.error('Error fetching locations:', error);
      res.status(500).json(formatError('Failed to fetch locations', error.message));
    }
  }

  static async getLocationStats(req, res) {
    try {
      const stats = await AdminService.getLocationStats();
      res.json(formatSuccess(stats, 'Location statistics retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching location stats:', error);
      res.status(500).json(formatError('Failed to fetch location statistics', error.message));
    }
  }

  static async getLocationCategories(req, res) {
    try {
      const categories = await AdminService.getLocationCategories();
      res.json(formatSuccess(categories, 'Location categories retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching location categories:', error);
      res.status(500).json(formatError('Failed to fetch location categories', error.message));
    }
  }

  static async getLocationStatuses(req, res) {
    try {
      const statuses = await AdminService.getLocationStatuses();
      res.json(formatSuccess(statuses, 'Location statuses retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching location statuses:', error);
      res.status(500).json(formatError('Failed to fetch location statuses', error.message));
    }
  }

  static async getSecuritySettings(req, res) {
    try {
      const turnstileEnabled = await getTurnstileEnabled();
      res.json(formatSuccess({ turnstileEnabled }, 'Security settings retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching security settings:', error);
      res.status(500).json(formatError('Failed to fetch security settings', error.message));
    }
  }

  static async updateSecuritySettings(req, res) {
    try {
      const { turnstileEnabled } = req.body;
      if (typeof turnstileEnabled !== 'boolean') {
        return res.status(400).json(formatError('turnstileEnabled must be a boolean', 400));
      }

      const updated = await setTurnstileEnabled(turnstileEnabled);
      return res.json(
        formatSuccess(
          { turnstileEnabled: updated },
          'Security settings updated successfully'
        )
      );
    } catch (error) {
      logger.error('Error updating security settings:', error);
      return res.status(500).json(formatError('Failed to update security settings', error.message));
    }
  }

  static async getChatbotSettings(req, res) {
    try {
      const chatbotEnabled = await getChatbotEnabled();
      return res.json(formatSuccess({ chatbotEnabled }, 'Chatbot settings retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching chatbot settings:', error);
      return res.status(500).json(formatError('Failed to fetch chatbot settings', error.message));
    }
  }

  static async updateChatbotSettings(req, res) {
    try {
      const { chatbotEnabled } = req.body || {};
      if (typeof chatbotEnabled !== 'boolean') {
        return res.status(400).json(formatError('chatbotEnabled must be a boolean', 400));
      }

      const updated = await setChatbotEnabled(chatbotEnabled);
      return res.json(
        formatSuccess(
          { chatbotEnabled: updated },
          'Chatbot settings updated successfully'
        )
      );
    } catch (error) {
      logger.error('Error updating chatbot settings:', error);
      return res.status(500).json(formatError('Failed to update chatbot settings', error.message));
    }
  }

  static async getMonitoringOverview(req, res) {
    try {
      const data = await AdminService.getMonitoringOverview();
      return res.json(formatSuccess(data, 'Monitoring overview retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching monitoring overview:', error);
      return res.status(500).json(formatError('Failed to fetch monitoring overview', error.message));
    }
  }

  static async getDashboardOverview(req, res) {
    try {
      const days = Number(req.query.days || 30);
      const data = await AdminService.getDashboardOverview(days);
      return res.json(formatSuccess(data, 'Dashboard overview retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching dashboard overview:', error);
      return res.status(500).json(formatError('Failed to fetch dashboard overview', error.message));
    }
  }

  static async getOperationalMetrics(req, res) {
    try {
      const hours = Number(req.query.hours || 24);
      const data = await AdminService.getOperationalMetrics(hours);
      return res.json(formatSuccess(data, 'Operational metrics retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching operational metrics:', error);
      return res.status(500).json(formatError('Failed to fetch operational metrics', error.message));
    }
  }

  static async streamMonitoring(req, res) {
    const sections = String(req.query.sections || 'overview,dashboard')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
    const hours = Math.max(1, Math.min(24 * 365, Number(req.query.hours || 24)));
    const intervalMs = Math.max(5000, Math.min(60000, Number(req.query.intervalMs || 15000)));
    const sloScope = String(req.query.scope || 'all').trim().toLowerCase();

    const scope = new Set(sections);
    const includes = (key) => scope.size === 0 || scope.has(key);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write('retry: 3000\n\n');

    let closed = false;
    const sendEvent = (eventName, payload) => {
      if (closed) return;
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const pushSnapshot = async () => {
      try {
        const payload = { timestamp: new Date().toISOString() };
        const tasks = [];

        if (includes('overview')) {
          tasks.push(AdminService.getMonitoringOverview().then((value) => { payload.overview = value; }));
        }
        if (includes('dashboard')) {
          tasks.push(AdminService.getDashboardOverview(days).then((value) => { payload.dashboard = value; }));
        }
        if (includes('operations')) {
          tasks.push(AdminService.getOperationalMetrics(hours).then((value) => { payload.operations = value; }));
        }
        if (includes('safety')) {
          tasks.push(AdminService.getSafetyGovernanceMetrics().then((value) => { payload.safety = value; }));
        }
        if (includes('recommendation')) {
          tasks.push(AdminService.getRecommendationInsights(days).then((value) => { payload.recommendation = value; }));
        }
        if (includes('image')) {
          tasks.push(AdminService.getImageClassifierInsights(hours).then((value) => { payload.image = value; }));
        }
        if (includes('blog')) {
          tasks.push(AdminService.getBlogInsights(hours).then((value) => { payload.blog = value; }));
        }
        if (includes('chatbot')) {
          tasks.push(AdminService.getChatbotInsights(hours, 20).then((value) => { payload.chatbot = value; }));
        }
        if (includes('slo')) {
          tasks.push(AdminService.getSloSlaSummary(days, { scope: sloScope }).then((value) => { payload.slo = value; }));
        }
        if (includes('endpoints')) {
          tasks.push(AdminService.getTopFailingEndpoints(hours, 8).then((value) => { payload.topFailingEndpoints = value; }));
        }
        if (includes('audit')) {
          tasks.push(AdminService.getAdminAuditTrail(20, days).then((value) => { payload.auditTrail = value; }));
        }

        await Promise.all(tasks);
        sendEvent('snapshot', payload);
      } catch (error) {
        sendEvent('error', { message: error.message || 'Failed to stream monitoring snapshot' });
      }
    };

    await pushSnapshot();
    const timer = setInterval(pushSnapshot, intervalMs);

    req.on('close', () => {
      closed = true;
      clearInterval(timer);
      res.end();
    });
  }

  static async getRecentErrorLogs(req, res) {
    try {
      const limit = Number(req.query.limit || 50);
      const hours = Number(req.query.hours || 24);
      const data = await AdminService.getRecentErrorLogs(limit, hours, {
        statusClass: req.query.statusClass || 'all',
        endpoint: req.query.endpoint || '',
        search: req.query.search || '',
      });
      return res.json(formatSuccess(data, 'Recent error logs retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching recent error logs:', error);
      return res.status(500).json(formatError('Failed to fetch recent error logs', error.message));
    }
  }

  static async getSafetyGovernanceMetrics(req, res) {
    try {
      const data = await AdminService.getSafetyGovernanceMetrics();
      return res.json(formatSuccess(data, 'Safety governance metrics retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching safety governance metrics:', error);
      return res.status(500).json(formatError('Failed to fetch safety governance metrics', error.message));
    }
  }

  static async getRecommendationInsights(req, res) {
    try {
      const days = Number(req.query.days || 30);
      const data = await AdminService.getRecommendationInsights(days);
      return res.json(formatSuccess(data, 'Recommendation insights retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching recommendation insights:', error);
      return res.status(500).json(formatError('Failed to fetch recommendation insights', error.message));
    }
  }

  static async getAdminAuditTrail(req, res) {
    try {
      const limit = Number(req.query.limit || 25);
      const days = Number(req.query.days || 30);
      const data = await AdminService.getAdminAuditTrail(limit, days);
      return res.json(formatSuccess(data, 'Admin audit trail retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching admin audit trail:', error);
      return res.status(500).json(formatError('Failed to fetch admin audit trail', error.message));
    }
  }

  static async getImageClassifierInsights(req, res) {
    try {
      const hours = Number(req.query.hours || 168);
      const data = await AdminService.getImageClassifierInsights(hours);
      return res.json(formatSuccess(data, 'Image classifier insights retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching image classifier insights:', error);
      return res.status(500).json(formatError('Failed to fetch image classifier insights', error.message));
    }
  }

  static async getBlogInsights(req, res) {
    try {
      const hours = Number(req.query.hours || 168);
      const data = await AdminService.getBlogInsights(hours);
      return res.json(formatSuccess(data, 'Blog insights retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching blog insights:', error);
      return res.status(500).json(formatError('Failed to fetch blog insights', error.message));
    }
  }

  static async getChatbotInsights(req, res) {
    try {
      const hours = Number(req.query.hours || 24);
      const limit = Number(req.query.limit || 20);
      const data = await AdminService.getChatbotInsights(hours, limit);
      return res.json(formatSuccess(data, 'Chatbot insights retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching chatbot insights:', error);
      return res.status(500).json(formatError('Failed to fetch chatbot insights', error.message));
    }
  }

  static async getTopFailingEndpoints(req, res) {
    try {
      const hours = Number(req.query.hours || 24);
      const limit = Number(req.query.limit || 10);
      const data = await AdminService.getTopFailingEndpoints(hours, limit);
      return res.json(formatSuccess(data, 'Top failing endpoints retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching top failing endpoints:', error);
      return res.status(500).json(formatError('Failed to fetch top failing endpoints', error.message));
    }
  }

  static async getLatencyByEndpoint(req, res) {
    try {
      const hours = Number(req.query.hours || 24);
      const limit = Number(req.query.limit || 20);
      const minCount = Number(req.query.minCount || 10);
      const scope = String(req.query.scope || 'all').trim().toLowerCase();
      const data = await AdminService.getLatencyByEndpoint(hours, limit, minCount, { scope });
      return res.json(formatSuccess(data, 'Latency by endpoint retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching latency by endpoint:', error);
      return res.status(500).json(formatError('Failed to fetch latency by endpoint', error.message));
    }
  }

  static async getSloSlaSummary(req, res) {
    try {
      const days = Number(req.query.days || 30);
      const scope = String(req.query.scope || 'all').trim().toLowerCase();
      const data = await AdminService.getSloSlaSummary(days, { scope });
      return res.json(formatSuccess(data, 'SLO/SLA summary retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching SLO/SLA summary:', error);
      return res.status(500).json(formatError('Failed to fetch SLO/SLA summary', error.message));
    }
  }

  static async getMonitoringAlertRule(req, res) {
    try {
      const data = await AdminService.getMonitoringAlertRule();
      return res.json(formatSuccess(data, 'Monitoring alert rule retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching monitoring alert rule:', error);
      return res.status(500).json(formatError('Failed to fetch monitoring alert rule', error.message));
    }
  }

  static async updateMonitoringAlertRule(req, res) {
    try {
      const data = await AdminService.updateMonitoringAlertRule(req.body || {});
      return res.json(formatSuccess(data, 'Monitoring alert rule updated successfully'));
    } catch (error) {
      logger.error('Error updating monitoring alert rule:', error);
      return res.status(500).json(formatError('Failed to update monitoring alert rule', error.message));
    }
  }

  static async triggerImageClassifierRetrain(req, res) {
    try {
      const data = await AdminService.triggerImageClassifierRetrain();
      return res.json(formatSuccess(data, 'Image classifier retrain triggered successfully'));
    } catch (error) {
      logger.error('Error triggering image classifier retrain:', error);
      return res.status(error.statusCode || 500).json(formatError('Failed to trigger image classifier retrain', error.message));
    }
  }

  static async triggerRecommendationRetrain(req, res) {
    try {
      const data = await AdminService.triggerRecommendationRetrain();
      return res.json(formatSuccess(data, 'Recommendation engine retrain triggered successfully'));
    } catch (error) {
      logger.error('Error triggering recommendation retrain:', error);
      return res.status(error.statusCode || 500).json(formatError('Failed to trigger recommendation retrain', error.message));
    }
  }

  static async getImageClassifierRetrainStatus(req, res) {
    try {
      const taskId = String(req.params.taskId || '').trim();
      if (!taskId) {
        return res.status(400).json(formatError('taskId is required', 400));
      }
      const data = await AdminService.getImageClassifierRetrainStatus(taskId);
      return res.json(formatSuccess(data, 'Image classifier retrain status retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching image classifier retrain status:', error);
      return res.status(error.statusCode || 500).json(formatError('Failed to fetch image classifier retrain status', error.message));
    }
  }

  static async getImageClassifierQueueHealth(req, res) {
    try {
      const data = await AdminService.getImageClassifierQueueHealth();
      return res.json(formatSuccess(data, 'Image classifier queue health retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching image classifier queue health:', error);
      return res.status(error.statusCode || 500).json(formatError('Failed to fetch image classifier queue health', error.message));
    }
  }

  static async reindexSearch(req, res) {
    try {
      if (!SearchService.isEnabled()) {
        return res.status(400).json(formatError('Meilisearch is not enabled', 400));
      }
      await SearchService.bootstrap();
      await SearchService.syncAll();
      return res.json(formatSuccess({ indexed: true }, 'Search indexes rebuilt successfully'));
    } catch (error) {
      logger.error('Error rebuilding search indexes:', error);
      return res.status(500).json(formatError('Failed to rebuild search indexes', error.message));
    }
  }

  static async exportMonitoringPdf(req, res) {
    try {
      const { report, reports, days = 7, hours = 168 } = req.query;
      const reportsArray = reports ? reports.split(',') : [report];
      
      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      let yPosition = 750;
      const lineHeight = 20;
      const margin = 50;
      
      // Title
      page.drawText('Analytics Report', {
        x: margin,
        y: yPosition,
        size: 24,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= lineHeight * 2;
      
      // Date range
      page.drawText(`Period: Last ${days} days (${hours} hours)`, {
        x: margin,
        y: yPosition,
        size: 12,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= lineHeight * 2;
      
      // Generate content for each report
      for (const reportName of reportsArray) {
        if (yPosition < 100) {
          // Add new page if needed
          const newPage = pdfDoc.addPage([612, 792]);
          yPosition = 750;
        }
        
        // Report title
        page.drawText(`${reportName.toUpperCase()}`, {
          x: margin,
          y: yPosition,
          size: 16,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= lineHeight * 1.5;
        
        // Generate report-specific content
        if (reportName === 'recommendation-insights') {
          const data = await AdminService.getRecommendationInsights(Number(days));
          
          // Summary stats
          page.drawText(`Total Recommendations: ${data.recommendations?.volume30d || 0}`, {
            x: margin,
            y: yPosition,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
          
          page.drawText(`Today's Volume: ${data.recommendations?.volumeToday || 0}`, {
            x: margin,
            y: yPosition,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
          
          page.drawText(`Heuristic Usage: 100%`, {
            x: margin,
            y: yPosition,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
          
          // Top symptoms
          if (data.symptomFrequency && data.symptomFrequency.length > 0) {
            yPosition -= lineHeight / 2;
            page.drawText('Top Symptoms:', {
              x: margin,
              y: yPosition,
              size: 12,
              font: boldFont,
              color: rgb(0, 0, 0),
            });
            yPosition -= lineHeight;
            
            data.symptomFrequency.slice(0, 10).forEach((symptom) => {
              page.drawText(`• ${symptom.symptom}: ${symptom.count} occurrences`, {
                x: margin + 10,
                y: yPosition,
                size: 10,
                font,
                color: rgb(0, 0, 0),
              });
              yPosition -= lineHeight * 0.8;
            });
          }
        } else if (reportName === 'operations') {
          const opsData = await AdminService.getOperationalMetrics(Number(hours));
          
          page.drawText(`Total Requests: ${opsData.totalRequests || 0}`, {
            x: margin,
            y: yPosition,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
          
          page.drawText(`Error Rate: ${opsData.errorRate || 0}%`, {
            x: margin,
            y: yPosition,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
          
          page.drawText(`Avg Response Time: ${opsData.avgResponseTime || 0}ms`, {
            x: margin,
            y: yPosition,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
        } else if (reportName === 'overview') {
          const overviewData = await AdminService.getMonitoringOverview();
          
          page.drawText(`Total Users: ${overviewData.totalUsers || 0}`, {
            x: margin,
            y: yPosition,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
          
          page.drawText(`Active Users: ${overviewData.activeUsers || 0}`, {
            x: margin,
            y: yPosition,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
          
          page.drawText(`System Uptime: ${overviewData.uptime || 0}%`, {
            x: margin,
            y: yPosition,
            size: 11,
            font,
            color: rgb(0, 0, 0),
          });
        } else {
          // Generic report handling
          page.drawText('Report data available in CSV format', {
            x: margin,
            y: yPosition,
            size: 11,
            font,
            color: rgb(0.5, 0.5, 0.5),
          });
          yPosition -= lineHeight;
        }
        
        yPosition -= lineHeight;
      }
      
      // Add footer
      yPosition = 50;
      page.drawText(`Generated on ${new Date().toLocaleString()}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      
      // Serialize PDF
      const pdfBytes = await pdfDoc.save();
      
      // Send PDF response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.status(200).send(Buffer.from(pdfBytes));
      
    } catch (error) {
      logger.error('Error generating PDF report:', error);
      return res.status(500).json(formatError('Failed to generate PDF report', error.message));
    }
  }

  static async exportMonitoringCsv(req, res) {
    try {
      const report = String(req.query.report || 'overview').trim().toLowerCase();
      let rows = [];
      let columns = [];
      let filename = `monitoring-${report}.csv`;

      if (report === 'overview') {
        const data = await AdminService.getMonitoringOverview();
        rows = [{
          users_total: data.users.total,
          users_active: data.users.active,
          users_missing_demographics: data.users.missingDemographics,
          herbs_total: data.herbs.total,
          herbs_active: data.herbs.active,
          herbs_missing_safety_profile: data.herbs.missingSafetyProfile,
          herbs_without_phytochemicals: data.herbs.withoutPhytochemicals,
          locations: data.domain.locations,
          symptoms: data.domain.symptoms,
          red_flag_symptoms: data.domain.redFlagSymptoms,
          phytochemicals: data.domain.phytochemicals,
        }];
        columns = Object.keys(rows[0]);
      } else if (report === 'operations') {
        const data = await AdminService.getOperationalMetrics(Number(req.query.hours || 24));
        rows = (data.trends?.requestByHour || []).map((item) => ({
          hour: item.label,
          requests: item.requests,
          errors_5xx: item.errors5xx,
          avg_latency_ms: item.avgLatencyMs,
        }));
        columns = ['hour', 'requests', 'errors_5xx', 'avg_latency_ms'];
      } else if (report === 'safety-governance') {
        const data = await AdminService.getSafetyGovernanceMetrics();
        const summaryRow = {
          metric: 'summary',
          herb_safety_unverified: data.unverified.herbSafety,
          interactions_unverified: data.unverified.interactions,
          contraindications_unverified: data.unverified.contraindications,
        };
        const queueRows = (data.oldestReviewQueue || []).map((item) => ({
          metric: 'oldest_review_queue',
          herb_safety_unverified: item.herb,
          interactions_unverified: item.lastReviewed ? new Date(item.lastReviewed).toISOString() : 'never',
          contraindications_unverified: item.verified ? 'verified' : 'unverified',
        }));
        rows = [summaryRow, ...queueRows];
        columns = ['metric', 'herb_safety_unverified', 'interactions_unverified', 'contraindications_unverified'];
      } else if (report === 'recommendation-insights') {
        const data = await AdminService.getRecommendationInsights(Number(req.query.days || 30));
        
        // Check if this is a combined export (multiple reports)
        const reports = req.query.reports ? req.query.reports.split(',') : null;
        
        if (reports && reports.length > 1) {
          // Combined export logic - create unified structure
          let csvRows = [];
          let csvColumns = ['report', 'date', 'metric_1', 'metric_2', 'metric_3', 'metric_4', 'metric_5', 'metric_6'];
          
          // Process each report and convert to unified format
          for (const reportName of reports) {
            if (reportName === 'overview') {
              const overviewData = await AdminService.getMonitoringOverview();
              csvRows.push({
                report: 'overview',
                date: 'System Overview',
                metric_1: overviewData.totalUsers || 0, // total_users
                metric_2: overviewData.activeUsers || 0, // active_users
                metric_3: overviewData.totalRequests || 0, // total_requests
                metric_4: overviewData.errorRate || 0, // error_rate
                metric_5: overviewData.avgResponseTime || 0, // avg_response_time
                metric_6: overviewData.uptime || 0 // uptime
              });
            } else if (reportName === 'recommendation-insights') {
              const trendRows = (data.trends?.recommendationsByDay || []).map((item) => ({
                report: 'recommendation-insights',
                date: item.date,
                metric_1: item.value || 0, // recommendations
                metric_2: data.recommendations?.volumeToday || 0, // volume_today
                metric_3: 100, // heuristic_usage_pct
                metric_4: data.recommendations?.volume30d > 0 ? 'Active' : 'Standby', // status
                metric_5: '',
                metric_6: ''
              }));
              csvRows.push(...trendRows);
              
              // Add symptom frequency as separate rows
              if (data.symptomFrequency && data.symptomFrequency.length > 0) {
                csvRows.push({ report: '', date: '', metric_1: '', metric_2: '', metric_3: '', metric_4: '', metric_5: '', metric_6: '' });
                csvRows.push({ report: 'recommendation-insights', date: 'Symptom Frequency', metric_1: 'Symptom', metric_2: 'Count', metric_3: '', metric_4: '', metric_5: '', metric_6: '' });
                data.symptomFrequency.forEach((symptom) => {
                  csvRows.push({
                    report: 'recommendation-insights',
                    date: '',
                    metric_1: symptom.symptom,
                    metric_2: symptom.count,
                    metric_3: '',
                    metric_4: '',
                    metric_5: '',
                    metric_6: ''
                  });
                });
              }
            } else if (reportName === 'image-classifier-insights') {
              const imageData = await AdminService.getImageClassifierInsights(Number(req.query.hours || 168));
              const predRows = (imageData.trends?.predictionsByDay || []).map((item) => ({
                report: 'image-classifier-insights',
                date: item.date,
                metric_1: item.value || 0, // predictions
                metric_2: (imageData.trends?.avgConfidenceByDay || []).find((confidence) => confidence.date === item.date)?.value || 0, // avg_confidence
                metric_3: (imageData.trends?.feedbackByDay || []).find((feedback) => feedback.date === item.date)?.value || 0, // feedback_count
                metric_4: imageData.performance?.p95InferenceMs || 0, // p95_inference_ms
                metric_5: '',
                metric_6: ''
              }));
              csvRows.push(...predRows);
            } else if (reportName === 'blog-insights') {
              const blogData = await AdminService.getBlogInsights(Number(req.query.hours || 168));
              const blogCreated = (blogData.trends?.createdByDay || []).map((item) => ({
                report: 'blog-insights',
                date: item.date || item.key,
                metric_1: item.value || 0, // created
                metric_2: (blogData.trends?.publishedByDay || []).find((pub) => (pub.date || pub.key) === (item.date || item.key))?.value || 0, // published
                metric_3: '',
                metric_4: '',
                metric_5: '',
                metric_6: ''
              }));
              csvRows.push(...blogCreated);
            } else if (reportName === 'safety-governance') {
              const safetyData = await AdminService.getSafetyGovernanceMetrics(Number(req.query.days || 30));
              const safetyRows = (safetyData.trends?.daily || []).map((item) => ({
                report: 'safety-governance',
                date: item.date,
                metric_1: item.flaggedHerbs || 0, // flagged_herbs
                metric_2: item.pendingReviews || 0, // pending_reviews
                metric_3: item.resolvedToday || 0, // resolved_today
                metric_4: item.avgReviewTimeHours || 0, // avg_review_time_hours
                metric_5: '',
                metric_6: ''
              }));
              csvRows.push(...safetyRows);
            } else if (reportName === 'operations') {
              const opsData = await AdminService.getOperationalMetrics(Number(req.query.hours || 168));
              const opsRows = (opsData.trends?.requestByHour || []).map((item) => ({
                report: 'operations',
                date: item.hour || item.date, // handle both hour and date fields
                metric_1: item.totalRequests || item.requests || 0, // total_requests (try both field names)
                metric_2: item.errorRatePct || item.errorRate || 0, // error_rate_pct (try both field names)
                metric_3: item.avgResponseTimeMs || item.avgResponseTime || 0, // avg_response_time_ms (try both field names)
                metric_4: item.uniqueUsers || item.users || 0, // unique_users (try both field names)
                metric_5: '',
                metric_6: ''
              }));
              csvRows.push(...opsRows);
            }
          }
          
          rows = csvRows;
          columns = csvColumns;
          filename = `analytics-combined-${new Date().toISOString().split('T')[0]}.csv`;
        } else {
          // Single report - use original logic
          rows = (data.trends?.recommendationsByDay || []).map((item) => ({
            date: item.date,
            recommendations: item.value,
            volume_today: data.recommendations?.volumeToday || 0,
            heuristic_usage_pct: 100,
            status: data.recommendations?.volume30d > 0 ? 'Active' : 'Standby',
          }));
          columns = ['date', 'recommendations', 'volume_today', 'heuristic_usage_pct', 'status'];
          
          // Add symptom frequency data
          if (data.symptomFrequency && data.symptomFrequency.length > 0) {
            rows.push({});
            rows.push({ 
              metric: 'Symptom Frequency',
              symptom: '',
              count: '',
              _comment: 'Top symptoms from recommendation requests'
            });
            data.symptomFrequency.forEach((symptom) => {
              rows.push({
                metric: 'Symptom',
                symptom: symptom.symptom,
                count: symptom.count,
              });
            });
            columns = [...columns, 'metric', 'symptom', 'count'];
          }
          filename = `recommendation-insights-${new Date().toISOString().split('T')[0]}.csv`;
        }
      } else if (report === 'audit-trail') {
        const data = await AdminService.getAdminAuditTrail(
          Number(req.query.limit || 100),
          Number(req.query.days || 30)
        );
        rows = data.map((item) => ({
          type: item.type,
          target: item.target,
          verified: item.verified,
          updated_at: item.updatedAt ? new Date(item.updatedAt).toISOString() : '',
        }));
        columns = ['type', 'target', 'verified', 'updated_at'];
      } else if (report === 'image-classifier-insights') {
        const data = await AdminService.getImageClassifierInsights(Number(req.query.hours || 168));
        rows = (data.trends?.predictionsByDay || []).map((item) => ({
          date: item.date,
          predictions: item.value,
          avg_confidence: (data.trends?.avgConfidenceByDay || []).find((confidence) => confidence.date === item.date)?.value || 0,
          feedback_count: (data.trends?.feedbackByDay || []).find((feedback) => feedback.date === item.date)?.value || 0,
          p95_inference_ms: data.performance?.p95InferenceMs || 0,
          correction_rate_pct: data.feedback?.correctionRate || 0,
        }));
        columns = ['date', 'predictions', 'avg_confidence', 'feedback_count', 'p95_inference_ms', 'correction_rate_pct'];
      } else if (report === 'blog-insights') {
        const data = await AdminService.getBlogInsights(Number(req.query.hours || 168));
        rows = (data.trends?.createdByDay || []).map((item) => ({
          date: item.date,
          created: item.value,
          published: (data.trends?.publishedByDay || []).find((entry) => entry.date === item.date)?.value || 0,
          pending_review: data.status?.review || 0,
          total_published: data.status?.published || 0,
          total_draft: data.status?.draft || 0,
          total_archived: data.status?.archived || 0,
        }));
        columns = ['date', 'created', 'published', 'pending_review', 'total_published', 'total_draft', 'total_archived'];
      } else {
        return res.status(400).json(formatError('Invalid report type', 400));
      }

      const csv = AdminService.toCsv(rows, columns);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    } catch (error) {
      logger.error('Error exporting monitoring CSV:', error);
      return res.status(500).json(formatError('Failed to export monitoring CSV', error.message));
    }
  }
}

module.exports = AdminController;
