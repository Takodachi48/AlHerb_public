const { formatSuccess, formatError, formatPaginatedResponse } = require('../utils/responseFormatter');
const PhytochemicalAdminService = require('../services/phytochemicalAdminService');

class PhytochemicalAdminController {
  static async list(req, res) {
    const result = await PhytochemicalAdminService.listPhytochemicals(req.query);
    res.json(formatPaginatedResponse(
      result.items,
      result.pagination.currentPage,
      result.pagination.itemsPerPage,
      result.pagination.totalItems,
      'Phytochemicals retrieved successfully'
    ));
  }

  static async detail(req, res) {
    const result = await PhytochemicalAdminService.getPhytochemicalDetail(req.params.id, req.query);
    if (!result) {
      return res.status(404).json(formatError('Phytochemical not found', 404));
    }

    return res.json(formatSuccess(result, 'Phytochemical detail retrieved successfully'));
  }

  static async create(req, res) {
    try {
      const created = await PhytochemicalAdminService.createPhytochemical(req.body, req.user?._id);
      res.status(201).json(formatSuccess(created, 'Phytochemical created successfully'));
    } catch (error) {
      res.status(400).json(formatError('Failed to create phytochemical', 400, error.message));
    }
  }

  static async update(req, res) {
    try {
      const updated = await PhytochemicalAdminService.updatePhytochemical(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json(formatError('Phytochemical not found', 404));
      }
      return res.json(formatSuccess(updated, 'Phytochemical updated successfully'));
    } catch (error) {
      return res.status(400).json(formatError('Failed to update phytochemical', 400, error.message));
    }
  }

  static async archive(req, res) {
    const archived = await PhytochemicalAdminService.archivePhytochemical(req.params.id);
    if (!archived) {
      return res.status(404).json(formatError('Phytochemical not found', 404));
    }
    return res.json(formatSuccess(archived, 'Phytochemical archived successfully'));
  }

  static async listHerbs(req, res) {
    const items = await PhytochemicalAdminService.listHerbs(req.query.q || '', req.query.limit || 20);
    res.json(formatSuccess(items, 'Herbs retrieved successfully'));
  }

  static async saveAssignment(req, res) {
    try {
      const saved = await PhytochemicalAdminService.saveAssignment(req.body, req.user?._id);
      res.json(formatSuccess(saved, 'Assignment saved successfully'));
    } catch (error) {
      const status = error.message.includes('not found') ? 404 : 400;
      res.status(status).json(formatError('Failed to save assignment', status, error.message));
    }
  }
}

module.exports = PhytochemicalAdminController;
