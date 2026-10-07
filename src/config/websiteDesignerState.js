import { reuseEqualBranches } from '../utils/reuseEqualBranches';

// Copy only the edited path. Unchanged branches are shared by the draft and its
// bounded undo history instead of cloning the catalog/menus/images per keypress.
export function setDesignerValue(source, path, value) {
  if (!path.length) return value;
  const [key, ...rest] = path;
  const previous = source?.[key];
  const next = setDesignerValue(previous, rest, value);
  if (Object.is(previous, next)) return source;
  const result = Array.isArray(source) ? source.slice() : { ...source };
  result[key] = next;
  return result;
}

export const initialDesignerState = { draft: null, undoStack: [], redoStack: [], lastEdit: null };
const HISTORY_LIMIT = 50;
const append = (stack, value) => [...stack.slice(-(HISTORY_LIMIT - 1)), value];

export function designerReducer(state, action) {
  const { draft, undoStack, redoStack } = state;
  if (action.type === 'section') {
    const index = draft.homepage.sections.findIndex((section) => section.id === action.id);
    return index === -1 ? state : designerReducer(state, { ...action, type: 'edit', path: ['homepage', 'sections', index, action.field] });
  }
  if (action.type === 'move-section') {
    const sections = [...draft.homepage.sections].sort((a, b) => a.order - b.order);
    const index = sections.findIndex((section) => section.id === action.id);
    const target = index + action.direction;
    if (index === -1 || target < 0 || target >= sections.length) return state;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    return designerReducer(state, { type: 'edit', path: ['homepage', 'sections'],
      value: sections.map((section, order) => section.order === order * 10 ? section : { ...section, order: order * 10 }) });
  }
  if (action.type === 'reset') return { ...initialDesignerState, draft: action.draft };
  if (action.type === 'undo') return undoStack.length ? {
    draft: undoStack[undoStack.length - 1], undoStack: undoStack.slice(0, -1), redoStack: append(redoStack, draft), lastEdit: null,
  } : state;
  if (action.type === 'redo') return redoStack.length ? {
    draft: redoStack[redoStack.length - 1], undoStack: append(undoStack, draft), redoStack: redoStack.slice(0, -1), lastEdit: null,
  } : state;
  if (action.type !== 'edit' && action.type !== 'replace') return state;
  let next = action.type === 'replace' ? reuseEqualBranches(draft, action.draft) : setDesignerValue(draft, action.path, action.value);
  if (next === draft) return state;
  if (action.type === 'edit' && ['colors', 'typography', 'header', 'layout'].includes(action.path[0])) {
    next = setDesignerValue(next, ['theme', 'enhancedStyles'], true);
  }
  // Continuous typing/slider movement is one undo step. Separate fields,
  // checkboxes, catalog selections and preset changes remain separate actions.
  const key = action.type === 'edit' && ['string', 'number'].includes(typeof action.value) ? action.path.join('.') : null;
  const grouped = key && state.lastEdit?.key === key && action.time - state.lastEdit.time < 600;
  return { draft: next, undoStack: grouped ? undoStack : append(undoStack, draft), redoStack: [],
    lastEdit: key ? { key, time: action.time } : null };
}
