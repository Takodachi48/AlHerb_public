import React, { createContext, useContext, useMemo } from 'react';
import { loaderService } from './loaderService';

const LoaderContext = createContext(loaderService);

export const LoaderProvider = ({ children }) => {
  const value = useMemo(() => loaderService, []);
  return <LoaderContext.Provider value={value}>{children}</LoaderContext.Provider>;
};

export const useLoaderService = () => useContext(LoaderContext);

