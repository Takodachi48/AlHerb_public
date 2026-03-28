/* eslint-disable no-console */
require('dotenv').config();

const { connectDB } = require('../server/src/config/database');
const AdminService = require('../server/src/services/adminService');

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const main = async () => {
  const hours = parseNumber(process.argv[2], 24);
  const limit = parseNumber(process.argv[3], 20);
  const minCount = parseNumber(process.argv[4], 10);
  const scope = String(process.argv[5] || 'all').trim().toLowerCase();

  await connectDB();
  const rows = await AdminService.getLatencyByEndpoint(hours, limit, minCount, { scope });

  if (!rows.length) {
    console.log('No latency data found for the given window.');
  } else {
    console.table(rows);
  }

  process.exit(0);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
