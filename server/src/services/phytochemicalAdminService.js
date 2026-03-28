const mongoose = require('mongoose');
const Herb = require('../models/Herb');
const Phytochemical = require('../models/Phytochemical');
const PhytochemicalAssignment = require('../models/PhytochemicalAssignment');
const SearchService = require('./searchService');

const normalizeSource = (value = '') => String(value || '').trim().toLowerCase();

const concentrationLabel = (value, unit) => `${value} ${unit}`.trim();

class PhytochemicalAdminService {
  static async listPhytochemicals(options = {}) {
    const {
      page = 1,
      limit = 25,
      category = 'all',
      search = '',
      sort = 'name_asc',
      status = 'all',
    } = options;

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const match = {};
    let meiliPhytochemicalIds = null;
    let meiliPhytochemicalTotal = null;
    if (category && category !== 'all') match.category = category;
    if (search?.trim()) {
      const meili = await SearchService.searchPhytochemicalIds(search.trim(), {
        page,
        limit,
        category,
        status,
      }).catch(() => null);
      if (meili) {
        meiliPhytochemicalIds = meili.ids;
        meiliPhytochemicalTotal = meili.total;
        match._id = { $in: meiliPhytochemicalIds };
      } else {
        match.name = { $regex: search.trim(), $options: 'i' };
      }
    }
    if (status === 'active') match.isActive = true;
    if (status === 'archived') match.isActive = false;

    const sortMap = {
      name_asc: { name: 1 },
      assigned_herbs_desc: { assignedHerbCount: -1, name: 1 },
      updated_desc: { updatedAt: -1 },
    };

    const basePipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'phytochemicalassignments',
          let: { pid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$phytochemicalId', '$$pid'] },
                status: { $ne: 'archived' },
              },
            },
            { $group: { _id: '$herbId' } },
            { $count: 'count' },
          ],
          as: 'assignmentCounts',
        },
      },
      {
        $addFields: {
          assignedHerbCount: {
            $ifNull: [{ $arrayElemAt: ['$assignmentCounts.count', 0] }, 0],
          },
          status: { $cond: ['$isActive', 'active', 'archived'] },
        },
      },
      { $project: { assignmentCounts: 0 } },
    ];

    const [items, totalRow] = await Promise.all([
      Phytochemical.aggregate([
        ...basePipeline,
        { $sort: sortMap[sort] || sortMap.name_asc },
        { $skip: skip },
        { $limit: limitNum },
      ]),
      meiliPhytochemicalIds
        ? Promise.resolve([{ total: meiliPhytochemicalTotal }])
        : Phytochemical.aggregate([...basePipeline, { $count: 'total' }]),
    ]);

    if (meiliPhytochemicalIds) {
      const order = new Map(meiliPhytochemicalIds.map((id, idx) => [String(id), idx]));
      items.sort((a, b) => (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER));
    }

    const total = totalRow[0]?.total || 0;

    return {
      items,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
      },
    };
  }

  static async getPhytochemicalDetail(phytochemicalId, options = {}) {
    const {
      page = 1,
      limit = 50,
      herbSearch = '',
      herbPart = 'all',
      unit = 'all',
      assignmentStatus = 'all',
    } = options;

    const phytochemical = await Phytochemical.findById(phytochemicalId).lean();
    if (!phytochemical) {
      return null;
    }

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, Number.parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const match = {
      phytochemicalId: new mongoose.Types.ObjectId(phytochemicalId),
    };
    if (herbPart !== 'all') match.herbPart = herbPart;
    if (unit !== 'all') match.concentrationUnit = unit;
    if (assignmentStatus !== 'all') match.status = assignmentStatus;

    const herbMatchStage = herbSearch?.trim()
      ? [{
        $match: {
          $or: [
            { 'herb.name': { $regex: herbSearch.trim(), $options: 'i' } },
            { 'herb.scientificName': { $regex: herbSearch.trim(), $options: 'i' } },
            { herbId: { $regex: herbSearch.trim(), $options: 'i' } },
          ],
        },
      }]
      : [];

    const assignmentPipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'herbs',
          let: { herbKey: '$herbId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$herbKey'] },
                    { $eq: ['$slug', '$$herbKey'] },
                  ],
                },
              },
            },
          ],
          as: 'herb',
        },
      },
      { $unwind: { path: '$herb', preserveNullAndEmptyArrays: true } },
      ...herbMatchStage,
      { $sort: { concentrationValue: -1, updatedAt: -1 } },
    ];

    const [assignments, totalRow] = await Promise.all([
      PhytochemicalAssignment.aggregate([
        ...assignmentPipeline,
        { $skip: skip },
        { $limit: limitNum },
      ]),
      PhytochemicalAssignment.aggregate([
        ...assignmentPipeline,
        { $count: 'total' },
      ]),
    ]);

    const total = totalRow[0]?.total || 0;

    return {
      phytochemical: {
        ...phytochemical,
        status: phytochemical.isActive ? 'active' : 'archived',
      },
      assignments,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
      },
    };
  }

  static async createPhytochemical(payload, userId) {
    const record = await Phytochemical.create({
      name: payload.name,
      category: payload.category,
      description: payload.description || '',
      effects: payload.effects || [],
      isActive: true,
      verified: false,
      verifiedBy: userId || undefined,
    });
    return record.toObject();
  }

  static async updatePhytochemical(phytochemicalId, payload) {
    const update = {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.category !== undefined ? { category: payload.category } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.effects !== undefined ? { effects: payload.effects } : {}),
    };
    return Phytochemical.findByIdAndUpdate(
      phytochemicalId,
      update,
      { new: true, runValidators: true }
    ).lean();
  }

  static async archivePhytochemical(phytochemicalId) {
    return Phytochemical.findByIdAndUpdate(
      phytochemicalId,
      { isActive: false },
      { new: true, runValidators: true }
    ).lean();
  }

  static async listHerbs(search = '', limit = 20) {
    const query = { isActive: true };
    let meiliHerbIds = null;
    if (search?.trim()) {
      const meili = await SearchService.searchHerbIds(search.trim(), {
        page: 1,
        limit,
        status: 'active',
        category: 'all',
      }).catch(() => null);
      if (meili) {
        meiliHerbIds = meili.ids;
        query._id = { $in: meiliHerbIds };
      } else {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ name: regex }, { scientificName: regex }];
      }
    }

    const items = await Herb.find(query)
      .select('_id name scientificName')
      .sort({ name: 1 })
      .limit(Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20)))
      .lean();

    if (meiliHerbIds) {
      const order = new Map(meiliHerbIds.map((id, idx) => [String(id), idx]));
      items.sort((a, b) => (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER));
    }

    return items;
  }

  static async saveAssignment(payload, userId) {
    const phytochemical = await Phytochemical.findById(payload.phytochemicalId).lean();
    if (!phytochemical) {
      throw new Error('Phytochemical not found');
    }
    if (!phytochemical.isActive && payload.status === 'active') {
      throw new Error('Archived phytochemical cannot receive new active assignments');
    }

    const sourceReferenceNormalized = normalizeSource(payload.sourceReference);

    const duplicate = await PhytochemicalAssignment.findOne({
      phytochemicalId: payload.phytochemicalId,
      herbId: payload.herbId,
      herbPart: payload.herbPart,
      sourceReferenceNormalized,
      ...(payload.assignmentId ? { _id: { $ne: payload.assignmentId } } : {}),
    }).lean();

    if (duplicate) {
      throw new Error('Duplicate assignment detected for phytochemical/herb/part/source');
    }

    const baseUpdate = {
      phytochemicalId: payload.phytochemicalId,
      herbId: payload.herbId,
      herbPart: payload.herbPart,
      concentrationValue: payload.concentrationValue,
      concentrationUnit: payload.concentrationUnit,
      sourceReference: payload.sourceReference || '',
      sourceReferenceNormalized,
      extractionType: payload.extractionType || '',
      confidenceLevel: payload.confidenceLevel || 'medium',
      notes: payload.notes || '',
      status: payload.status || 'active',
      revisionNote: payload.revisionNote || '',
      updatedBy: userId || undefined,
    };

    let assignment;
    let previous;

    if (payload.assignmentId) {
      previous = await PhytochemicalAssignment.findById(payload.assignmentId).lean();
      assignment = await PhytochemicalAssignment.findByIdAndUpdate(
        payload.assignmentId,
        baseUpdate,
        { new: true, runValidators: true }
      ).lean();
    } else {
      assignment = await PhytochemicalAssignment.create({
        ...baseUpdate,
        createdBy: userId || undefined,
      });
      assignment = assignment.toObject();
    }

    if (!assignment) throw new Error('Assignment not found');

    await this.syncHerbPhytochemicals(assignment.herbId, assignment.phytochemicalId);
    if (previous && (previous.herbId !== assignment.herbId || String(previous.phytochemicalId) !== String(assignment.phytochemicalId))) {
      await this.syncHerbPhytochemicals(previous.herbId, previous.phytochemicalId);
    }

    return assignment;
  }

  static async syncHerbPhytochemicals(herbId, phytochemicalId) {
    const herb = await Herb.findById(herbId);
    if (!herb) return;

    const activeAssignments = await PhytochemicalAssignment.find({
      herbId,
      phytochemicalId,
      status: 'active',
    })
      .sort({ concentrationValue: -1, updatedAt: -1 })
      .lean();

    herb.phytochemicals = (herb.phytochemicals || []).filter(
      (entry) => String(entry.compound) !== String(phytochemicalId)
    );

    const mapped = activeAssignments.map((assignment) => ({
      compound: assignment.phytochemicalId,
      concentration: concentrationLabel(assignment.concentrationValue, assignment.concentrationUnit),
      partSource: assignment.herbPart,
    }));

    herb.phytochemicals.push(...mapped);
    await herb.save();
  }
}

module.exports = PhytochemicalAdminService;
