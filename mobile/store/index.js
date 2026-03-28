import { configureStore } from '@reduxjs/toolkit';
import herbsReducer from './herbsSlice';

export const store = configureStore({
    reducer: {
        herbs: herbsReducer,
        // Add other slices here (diseases, etc.)
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
});
