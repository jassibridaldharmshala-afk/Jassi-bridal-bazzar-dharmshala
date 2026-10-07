import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    globalMessage: '',
  },
  reducers: {
    setGlobalMessage(state, action) {
      state.globalMessage = action.payload || '';
    },
    clearGlobalMessage(state) {
      state.globalMessage = '';
    },
  },
});

export const { clearGlobalMessage, setGlobalMessage } = uiSlice.actions;
export default uiSlice.reducer;
