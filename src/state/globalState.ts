/**
 * Global state management for PromptPilot
 * Replaces React Reducer with plain JavaScript state management
 */

import { AppProps, ItemProps, ParseResult } from '@/types/props';

/**
 * Global application state
 */
export let globalState: AppProps = {
    isVisible: false,
    type: 'tag',
    textarea: null,
    selectedCategory: 'all',
    selectedItem: null,
    items: [],
    pos: {
        offset_x: 0,
        offset_y: 0,
        x: 0,
        y: 0,
    },
    parseResult: {
        promptInfo: {
            prompt: '',
            caretPosition: 0,
            inputtingString: '',
            activeWordIndex: -1,
            words: [],
        },
        insertionInfo: {
            isMetaBlock: false,
            needPrependComma: false,
            needPrependSpace: false,
        },
    },
    message: '',
};

/**
 * Type for state change listeners
 */
type StateChangeListener = (newState: AppProps) => void;

/**
 * Array of registered listeners
 */
const listeners: StateChangeListener[] = [];

/**
 * Register a listener for state changes
 * @param listener - Function to call when state changes
 * @returns Unsubscribe function
 */
export function addStateListener(listener: StateChangeListener): () => void {
    listeners.push(listener);
    return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    };
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(): void {
    listeners.forEach((listener) => listener(globalState));
}

/**
 * Update the global state and notify listeners
 * @param updates - Partial state updates
 */
export function updateGlobalState(updates: Partial<AppProps>): void {
    globalState = { ...globalState, ...updates };
    notifyListeners();
}

/**
 * Get current global state (read-only)
 */
export function getGlobalState(): Readonly<AppProps> {
    return globalState;
}

// State update functions (replacing dispatch actions)

/**
 * Set the textarea element
 * @param textarea - The textarea element or null
 */
export function setTextarea(textarea: PilotTextArea | null): void {
    updateGlobalState({
        isVisible: false,
        textarea,
        selectedCategory: 'all',
    });
}

/**
 * Set visibility of the suggestion box
 * @param isVisible - Whether the suggestion box should be visible
 */
export function setVisibility(isVisible: boolean): void {
    updateGlobalState({
        isVisible,
        selectedCategory: 'all',
    });
}

/**
 * Set the position of the suggestion box
 * @param position - The position coordinates
 */
export function setPosition(position: { x: number; y: number; offset_x: number; offset_y: number }): void {
    updateGlobalState({
        pos: {
            offset_x: position.offset_x,
            offset_y: position.offset_y,
            x: position.x,
            y: position.y,
        },
    });
}

/**
 * Set the selected tab/category
 * @param category - The category to select
 */
export function setTab(category: string): void {
    updateGlobalState({ selectedCategory: category });
}

/**
 * Set the selected item
 * @param item - The item to select
 */
export function setSelectedItem(item: ItemProps): void {
    updateGlobalState({ selectedItem: item });
}

/**
 * Set items and related state
 * @param type - The type of items
 * @param items - The items array
 */
export function setItems(type: 'tag' | 'lora', items: ItemProps[]): void {
    updateGlobalState({
        isVisible: true,
        type,
        items,
        selectedItem: items.length > 0 ? items[0] : null,
        message: items.length > 0 ? '' : 'No results found',
    });
}

/**
 * Set a message and related state
 * @param type - The type of message
 * @param message - The message text
 */
export function setMessage(type: 'tag' | 'lora', message: string): void {
    updateGlobalState({
        isVisible: true,
        type,
        message,
    });
}

/**
 * Set the parse result
 * @param parseResult - The new parse result
 */
export function setParseResult(parseResult: ParseResult): void {
    updateGlobalState({ parseResult });
}
