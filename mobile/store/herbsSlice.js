import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { herbService } from '../services/apiServices';

// Async thunk to fetch herbs
export const fetchHerbs = createAsyncThunk(
    'herbs/fetchHerbs',
    async (_, { rejectWithValue }) => {
        try {
            const data = await herbService.getAllHerbs();
            // Cache the fresh data
            await AsyncStorage.setItem('cached_herbs', JSON.stringify(data));
            return data;
        } catch (error) {
            // If fetch fails, try to load from cache
            try {
                const cached = await AsyncStorage.getItem('cached_herbs');
                if (cached) {
                    return JSON.parse(cached);
                }
            } catch (cacheError) {
                // ignore cache error
            }
            return rejectWithValue(error.message);
        }
    }
);

// Initial load from cache (for instant startup)
export const loadHerbsFromCache = createAsyncThunk(
    'herbs/loadCache',
    async () => {
        const cached = await AsyncStorage.getItem('cached_herbs');
        return cached ? JSON.parse(cached) : [];
    }
);

const herbsSlice = createSlice({
    name: 'herbs',
    initialState: {
        items: [],
        loading: false,
        error: null,
        lastUpdated: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch Herbs
            .addCase(fetchHerbs.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchHerbs.fulfilled, (state, action) => {
                state.loading = false;
                // backend returns { success: true, data: [...], pagination: ... }
                // or just [...] if changed in future
                const herbsData = action.payload.data || action.payload;
                state.items = Array.isArray(herbsData) ? herbsData : [];
                state.lastUpdated = Date.now();
            })
            .addCase(fetchHerbs.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to fetch herbs';
            })
            // Load Cache
            .addCase(loadHerbsFromCache.fulfilled, (state, action) => {
                const cachedData = action.payload;
                // Handle if cache stored the whole response object or just array
                const herbsData = cachedData?.data || cachedData;
                if (Array.isArray(herbsData) && herbsData.length > 0) {
                    state.items = herbsData;
                }
            });
    },
});

export default herbsSlice.reducer;
