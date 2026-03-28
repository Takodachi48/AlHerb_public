import React from 'react';
import { useLoader } from '../hooks/useLoader';
import Loading from './common/Loading';

const barCommon =
  'pointer-events-none fixed left-0 right-0 z-[90] transition-opacity duration-200 ease-out';

const GlobalLoader = () => {
  const state = useLoader((snapshot) => snapshot);

  if (!state.visible) return null;

  const percent = Math.round(state.progress * 1000) / 10;
  const widthStyle = { transform: `scaleX(${Math.max(0.001, state.progress)})` };
  const isDone = state.progress >= 0.999;

  if (state.mode === 'fullscreen') {
    return (
      <Loading
        variant="fullscreen-progress"
        text={state.message || 'Loading application...'}
        progressValue={state.progress * 100}
      />
    );
  }

  return (
    <>
      <div className={`${barCommon} top-0 h-1 bg-transparent ${isDone ? 'opacity-0' : 'opacity-100'}`}>
        <div
          className="h-full origin-left bg-interactive-accent-primary shadow-[0_0_12px_color-mix(in_srgb,var(--interactive-accent-primary)_40%,transparent)] transition-transform duration-75"
          style={widthStyle}
        />
      </div>
      {state.debug ? (
        <div className="fixed right-3 top-3 z-[91] rounded-md bg-black/75 px-2 py-1 text-[11px] text-white">
          {Object.values(state.tasks).filter((task) => !task.completed).length} active task(s)
        </div>
      ) : null}
    </>
  );
};

export default GlobalLoader;
