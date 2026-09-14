import { create } from "zustand";
import { attachPersistence } from "./persistence";
import { createNavSlice, type NavSlice } from "./slices/nav";
import { createConnectionSlice, type ConnectionSlice } from "./slices/connection";
import { createSessionSlice, type SessionSlice } from "./slices/session";
import { createDataSlice, type DataSlice } from "./slices/data";
import { createWorkbenchSlice, type WorkbenchSlice } from "./slices/workbench";
import {
  createRailSlice,
  createRunnerSlice,
  createToastSlice,
  createWsSlice,
  type RailSlice,
  type RunnerSlice,
  type ToastSlice,
  type WsSlice,
} from "./slices/misc";

export type StudioStore = NavSlice &
  ConnectionSlice &
  SessionSlice &
  DataSlice &
  WorkbenchSlice &
  RunnerSlice &
  RailSlice &
  WsSlice &
  ToastSlice;

export const useStore = create<StudioStore>()((...a) => ({
  ...createNavSlice(...a),
  ...createConnectionSlice(...a),
  ...createSessionSlice(...a),
  ...createDataSlice(...a),
  ...createWorkbenchSlice(...a),
  ...createRunnerSlice(...a),
  ...createRailSlice(...a),
  ...createWsSlice(...a),
  ...createToastSlice(...a),
}));

/* Chrome preferences and per-project workspace are mirrored to localStorage.
   See state/persistence.ts for exactly what is and is not kept. */
attachPersistence(useStore);
