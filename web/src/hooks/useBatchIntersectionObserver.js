import { useCallback, useEffect, useRef } from 'react';

const applyVisibleState = (node) => {
  node.classList.add('io-visible');
};

const useBatchIntersectionObserver = ({
  threshold = 0.12,
  root = null,
  rootMargin = '120px 0px',
  once = true,
} = {}) => {
  const observerRef = useRef(null);
  const nodesByKeyRef = useRef(new Map());
  const refsByKeyRef = useRef(new Map());

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      nodesByKeyRef.current.forEach((node) => applyVisibleState(node));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          applyVisibleState(entry.target);
          if (once) observer.unobserve(entry.target);
        });
      },
      { threshold, root, rootMargin }
    );

    observerRef.current = observer;
    nodesByKeyRef.current.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [once, root, rootMargin, threshold]);

  const observeByKey = useCallback((key) => {
    if (!refsByKeyRef.current.has(key)) {
      refsByKeyRef.current.set(key, (node) => {
        const previous = nodesByKeyRef.current.get(key);
        if (previous && observerRef.current) observerRef.current.unobserve(previous);

        if (!node) {
          nodesByKeyRef.current.delete(key);
          return;
        }

        nodesByKeyRef.current.set(key, node);
        if (observerRef.current) observerRef.current.observe(node);
      });
    }

    return refsByKeyRef.current.get(key);
  }, []);

  return observeByKey;
};

export default useBatchIntersectionObserver;
