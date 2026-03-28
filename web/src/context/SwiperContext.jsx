import React, { createContext, useContext } from 'react';

export const SwiperContext = createContext(null);

export const useSwiper = () => {
  const context = useContext(SwiperContext);
  return context;
};

export const SwiperProvider = ({ children, swiper }) => {
  return (
    <SwiperContext.Provider value={swiper}>
      {children}
    </SwiperContext.Provider>
  );
};
