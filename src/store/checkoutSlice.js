import { createSlice } from '@reduxjs/toolkit';

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: {
    selectedAddressId: null,
    paymentMethod: 'COD',
  },
  reducers: {
    setSelectedAddressId(state, action) {
      state.selectedAddressId = action.payload;
    },
    setPaymentMethod(state, action) {
      state.paymentMethod = action.payload;
    },
    resetCheckout(state) {
      state.selectedAddressId = null;
      state.paymentMethod = 'COD';
    },
  },
});

export const { resetCheckout, setPaymentMethod, setSelectedAddressId } = checkoutSlice.actions;
export default checkoutSlice.reducer;
