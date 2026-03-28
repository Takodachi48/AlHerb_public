import { useEffect, useState } from 'react';

const useLoaderTransition = (loading) => {
  const [showLoader, setShowLoader] = useState(Boolean(loading));
  const [loaderComplete, setLoaderComplete] = useState(false);

  useEffect(() => {
    if (loading) {
      setShowLoader(true);
      setLoaderComplete(false);
      return;
    }

    if (showLoader) {
      setLoaderComplete(true);
    }
  }, [loading, showLoader]);

  const handleLoaderComplete = () => {
    setShowLoader(false);
    setLoaderComplete(false);
  };

  return { showLoader, loaderComplete, handleLoaderComplete };
};

export default useLoaderTransition;
