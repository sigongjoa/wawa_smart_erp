import { create } from 'zustand';
import type { MakeupRecord, MakeupStatus } from '../types';
import { fetchMakeupRecords, createMakeupRecord, updateMakeupRecord, deleteMakeupRecord } from '../services/notion';

interface MakeupState {
  records: MakeupRecord[];
  isLoading: boolean;

  fetchRecords: (status?: MakeupStatus) => Promise<void>;
  addRecord: (record: {
    studentId: string;
    studentName: string;
    subject: string;
    teacherId?: string;
    absentDate: string;
    absentReason: string;
    makeupDate?: string;
    makeupTime?: string;
    memo?: string;
  }) => Promise<boolean>;
  updateRecord: (id: string, updates: {
    makeupDate?: string;
    makeupTime?: string;
    status?: MakeupStatus;
    memo?: string;
  }) => Promise<boolean>;
  deleteRecord: (id: string) => Promise<boolean>;
}

export const useMakeupStore = create<MakeupState>((set, get) => ({
  records: [],
  isLoading: false,

  fetchRecords: async (status?: MakeupStatus) => {
    set({ isLoading: true });
    try {
      const records = await fetchMakeupRecords(status);
      set({ records });
    } catch (error) {
      console.error('[MakeupStore] fetchRecords failed:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addRecord: async (record) => {
    try {
      const result = await createMakeupRecord(record);
      if (result.success) {
        await get().fetchRecords();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[MakeupStore] addRecord failed:', error);
      return false;
    }
  },

  updateRecord: async (id, updates) => {
    try {
      const result = await updateMakeupRecord(id, updates);
      if (result.success) {
        await get().fetchRecords();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[MakeupStore] updateRecord failed:', error);
      return false;
    }
  },

  deleteRecord: async (id) => {
    try {
      const result = await deleteMakeupRecord(id);
      if (result.success) {
        await get().fetchRecords();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[MakeupStore] deleteRecord failed:', error);
      return false;
    }
  },
}));
