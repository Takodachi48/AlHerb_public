const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const INITIAL_STATE = {
  visible: false,
  mode: 'topbar',
  progress: 0,
  targetProgress: 0,
  isFinishing: false,
  message: '',
  pendingLoads: 0,
  tasks: {},
  totalWeight: 0,
  completedWeight: 0,
  initialLoadCompleted: false,
  debug: false,
};

class LoaderService {
  constructor() {
    this.state = { ...INITIAL_STATE };
    this.listeners = new Set();
    this.rafId = null;
    this.hideTimer = null;
    this.startedAt = 0;
    this.lastSignalAt = 0;
    this.lastTickAt = 0;
    this.namedLoads = new Set();
    this.anonymousLoads = 0;
  }

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  patchState(partial) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  ensureLoop() {
    if (this.rafId !== null) return;
    this.lastTickAt = performance.now();
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  stopLoop() {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  tick = (now) => {
    const deltaMs = now - this.lastTickAt;
    this.lastTickAt = now;
    let next = this.state;
    let changed = false;

    if (next.visible && !next.isFinishing && now - this.lastSignalAt > 160) {
      const rampPerMs = next.mode === 'fullscreen' ? 0.00018 : 0.00028;
      const rampTarget = Math.min(0.9, next.targetProgress + deltaMs * rampPerMs);
      if (rampTarget > next.targetProgress) {
        next = { ...next, targetProgress: rampTarget };
        changed = true;
      }
    }

    if (next.visible) {
      const smoothing = next.isFinishing ? 0.35 : 0.1;
      const progress = next.progress + (next.targetProgress - next.progress) * smoothing;
      const normalized = next.isFinishing && next.targetProgress >= 1 && progress > 0.985
        ? 1
        : Math.min(next.targetProgress, progress > 0.999 ? 1 : progress);
      if (Math.abs(normalized - next.progress) > 0.0005) {
        next = { ...next, progress: normalized };
        changed = true;
      }

      if (next.isFinishing && normalized >= 0.995 && this.hideTimer === null) {
        this.hideTimer = window.setTimeout(() => {
          const completedInitial = this.state.initialLoadCompleted || this.state.mode === 'fullscreen';
          this.state = {
            ...INITIAL_STATE,
            mode: completedInitial ? 'topbar' : 'fullscreen',
            initialLoadCompleted: completedInitial,
            debug: this.state.debug,
          };
          this.hideTimer = null;
          this.stopLoop();
          this.emit();
        }, 120);
      }
    }

    if (changed) {
      this.state = next;
      this.emit();
    }

    if (this.state.visible || this.state.pendingLoads > 0 || this.state.totalWeight > 0) {
      this.rafId = window.requestAnimationFrame(this.tick);
      return;
    }
    this.stopLoop();
  };

  updateProgressFromTasks() {
    const { totalWeight, completedWeight, isFinishing } = this.state;
    if (totalWeight <= 0 || isFinishing) return;
    const ratio = completedWeight / totalWeight;
    const target = clamp(ratio, 0, 0.9);
    if (target > this.state.targetProgress) {
      this.patchState({ targetProgress: target });
      this.lastSignalAt = performance.now();
    }
  }

  begin(mode, message = '') {
    const safeMode = mode || (this.state.initialLoadCompleted ? 'topbar' : 'fullscreen');
    const pendingLoads = this.namedLoads.size + this.anonymousLoads;
    const nextProgress = this.state.visible ? this.state.progress : Math.max(this.state.progress, 0.02);
    this.startedAt = this.state.visible ? this.startedAt : performance.now();
    this.lastSignalAt = performance.now();
    this.patchState({
      visible: true,
      mode: safeMode,
      message: message || this.state.message,
      pendingLoads,
      progress: nextProgress,
      targetProgress: Math.max(this.state.targetProgress, 0.06),
      isFinishing: false,
    });
    this.ensureLoop();
  }

  activate(mode, message = '') {
    const safeMode = mode || (this.state.initialLoadCompleted ? 'topbar' : 'fullscreen');
    const nextProgress = this.state.visible ? this.state.progress : Math.max(this.state.progress, 0.02);
    if (!this.state.visible) {
      this.startedAt = performance.now();
    }
    this.lastSignalAt = performance.now();
    this.patchState({
      visible: true,
      mode: safeMode,
      message: message || this.state.message,
      progress: nextProgress,
      targetProgress: Math.max(this.state.targetProgress, 0.06),
      isFinishing: false,
    });
    this.ensureLoop();
  }

  tryFinish() {
    if (this.state.pendingLoads > 0) return;
    if (this.state.totalWeight > 0 && this.state.completedWeight < this.state.totalWeight) return;
    if (!this.state.visible || this.state.isFinishing) return;

    const now = performance.now();
    const minDurationMs = this.state.mode === 'fullscreen' ? 600 : 0;
    const elapsed = now - this.startedAt;
    if (elapsed < minDurationMs) {
      window.setTimeout(() => this.tryFinish(), minDurationMs - elapsed);
      return;
    }

    this.lastSignalAt = now;
    this.patchState({
      isFinishing: true,
      progress: Math.max(this.state.progress, 0.94),
      targetProgress: 1,
      message: this.state.message,
    });
    this.ensureLoop();
  }

  start = (options = {}) => {
    const mode = typeof options === 'string' ? options : options.mode;
    const message = typeof options === 'object' ? options.message : '';
    const id = typeof options === 'object' ? options.id : undefined;

    if (id) {
      this.namedLoads.add(id);
    } else {
      this.anonymousLoads += 1;
    }

    this.begin(mode, message);
  };

  finish = (id) => {
    if (id) {
      this.namedLoads.delete(id);
    } else {
      this.anonymousLoads = Math.max(0, this.anonymousLoads - 1);
    }
    this.patchState({ pendingLoads: this.namedLoads.size + this.anonymousLoads });
    this.tryFinish();
  };

  addTask = (id, weight = 1) => {
    if (!id || this.state.tasks[id]) return;
    const taskWeight = Number.isFinite(weight) && weight > 0 ? weight : 1;
    const tasks = {
      ...this.state.tasks,
      [id]: { id, weight: taskWeight, completed: false },
    };
    this.lastSignalAt = performance.now();
    this.patchState({
      tasks,
      totalWeight: this.state.totalWeight + taskWeight,
    });
    this.activate('topbar');
    this.updateProgressFromTasks();
  };

  completeTask = (id) => {
    const task = this.state.tasks[id];
    if (!task || task.completed) return;
    const tasks = {
      ...this.state.tasks,
      [id]: { ...task, completed: true },
    };
    const completedWeight = this.state.completedWeight + task.weight;
    this.lastSignalAt = performance.now();
    this.patchState({ tasks, completedWeight });
    this.updateProgressFromTasks();
    this.tryFinish();
  };

  setProgress = (value) => {
    const normalized = clamp(value, 0, 1);
    const capped = normalized >= 1 ? 1 : Math.min(0.9, normalized);
    if (capped < this.state.targetProgress) return;
    this.lastSignalAt = performance.now();
    this.activate(this.state.mode);
    this.patchState({ targetProgress: capped });
    this.ensureLoop();
  };

  setMessage = (message) => {
    this.patchState({ message: message || '' });
  };

  setDebug = (debug) => {
    this.patchState({ debug: Boolean(debug) });
  };
}

export const loaderService = new LoaderService();
