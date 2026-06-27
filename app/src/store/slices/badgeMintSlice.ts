import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getCacheTimestamp } from '../utils/cacheUtils';


interface UserBadgeInfo {
  hasMinted: boolean;
  badgeId: string | null;
  serial: number | null;
  totalMinted: number;
}

interface BadgeMintState {
  info: UserBadgeInfo | null;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  lastWalletAddress: string | null;
}

const initialState: BadgeMintState = {
  info: null,
  loading: false,
  error: null,
  lastFetch: null,
  lastWalletAddress: null,
};

export const fetchBadgeStatus = createAsyncThunk(
  'badgeMint/fetchBadgeStatus',
  async ({ address }: { address: string }, { getState }) => {
    // On-chain badge minting (a Sui-only feature) is not yet available on Stackpilot.
    // Return a neutral "not minted" status so the badge page renders cleanly.
    const state = getState() as { badgeMint: BadgeMintState };
    const info: UserBadgeInfo = state.badgeMint.info ?? {
      hasMinted: false,
      badgeId: null,
      serial: null,
      totalMinted: 0,
    };
    return { info, fromCache: false, address };
  }
);

const badgeMintSlice = createSlice({
  name: 'badgeMint',
  initialState,
  reducers: {
    invalidateBadgeCache: (state) => {
      state.lastFetch = null;
    },
    updateTotalMinted: (state, action: PayloadAction<number>) => {
      if (state.info) {
        state.info.totalMinted = action.payload;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBadgeStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBadgeStatus.fulfilled, (state, action) => {
        state.loading = false;
        if (!action.payload.fromCache) {
          state.info = action.payload.info;
          state.lastFetch = getCacheTimestamp();
          state.lastWalletAddress = action.payload.address;
        }
      })
      .addCase(fetchBadgeStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { invalidateBadgeCache, updateTotalMinted } = badgeMintSlice.actions;
export default badgeMintSlice.reducer;
