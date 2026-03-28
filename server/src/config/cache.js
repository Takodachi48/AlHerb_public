const NodeCache = require('node-cache');

// Standard TTL of 5 minutes, check for expired keys every 60 seconds
const cache = new NodeCache({
    stdTTL: 300,
    checkperiod: 60,
    useClones: false, // For better performance with large objects
});

module.exports = cache;
