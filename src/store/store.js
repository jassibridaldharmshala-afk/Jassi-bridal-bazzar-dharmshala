import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import catalogReducer from './catalogSlice';
import checkoutReducer from './checkoutSlice';
import uiReducer from './uiSlice';
import { samiraApi } from './apiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    catalog: catalogReducer,
    checkout: checkoutReducer,
    ui: uiReducer,
    [samiraApi.reducerPath]: samiraApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(samiraApi.middleware),
});
