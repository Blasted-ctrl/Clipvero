import { createStore } from "zustand/vanilla";
import type { Timeline } from "./model";
type EditorState = {
  timeline: Timeline;
  past: Timeline[];
  future: Timeline[];
  change: (fn: (draft: Timeline) => void) => void;
  undo: () => void;
  redo: () => void;
};
export function createEditorStore(timeline: Timeline) {
  return createStore<EditorState>((set) => ({
    timeline: structuredClone(timeline),
    past: [],
    future: [],
    change: (fn) =>
      set((state) => {
        const draft = structuredClone(state.timeline);
        fn(draft);
        return {
          timeline: draft,
          past: [...state.past, state.timeline].slice(-50),
          future: [],
        };
      }),
    undo: () =>
      set((state) => {
        if (!state.past.length) return state;
        return {
          timeline: state.past[state.past.length - 1],
          past: state.past.slice(0, -1),
          future: [state.timeline, ...state.future],
        };
      }),
    redo: () =>
      set((state) => {
        if (!state.future.length) return state;
        return {
          timeline: state.future[0],
          past: [...state.past, state.timeline],
          future: state.future.slice(1),
        };
      }),
  }));
}
