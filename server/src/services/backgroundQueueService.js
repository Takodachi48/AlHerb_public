const { logger } = require('../utils/logger');

class BackgroundQueueService {
  constructor({ concurrency = 3 } = {}) {
    this.concurrency = concurrency;
    this.activeCount = 0;
    this.jobs = [];
  }

  add(jobName, handler) {
    this.jobs.push({ jobName, handler });
    setImmediate(() => this._process());
  }

  _process() {
    while (this.activeCount < this.concurrency && this.jobs.length > 0) {
      const job = this.jobs.shift();
      this.activeCount += 1;

      Promise.resolve()
        .then(job.handler)
        .catch((error) => {
          logger.error(`Background job failed: ${job.jobName}`, error);
        })
        .finally(() => {
          this.activeCount -= 1;
          this._process();
        });
    }
  }
}

module.exports = new BackgroundQueueService({ concurrency: 5 });
