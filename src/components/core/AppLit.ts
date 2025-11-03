import { render } from 'lit-html';
import { AppProps } from '@/types/props';
import { globalState, addStateListener, updateGlobalState } from '@/state/globalState';
import { createUITemplate } from '@/components/ui/AppComponentLit';

let currentState: AppProps = globalState;
let unsubscribeListener: (() => void) | null = null;

/**
 * Re-render the application when state changes
 */
export function renderApp(): void {
    const container = document.getElementById('prompt-pilot-container');
    if (!container) {
        console.info('Container element not found');
        return;
    }

    const template = createUITemplate(currentState);
    render(template, container);
}

/**
 * Initialize the application with lit-html
 * @param promptPilotProps - Initial application props
 */
export function initialize(promptPilotProps: AppProps): void {
    // Initialize global state with provided props
    updateGlobalState(promptPilotProps);
    currentState = { ...globalState };

    // Subscribe to global state changes
    if (unsubscribeListener) {
        unsubscribeListener();
    }

    unsubscribeListener = addStateListener((newState) => {
        currentState = { ...newState };
        renderApp();
    });
}

/**
 * Cleanup function to remove listeners
 */
export function cleanup(): void {
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
}

/**
 * Get current application state
 */
export function getCurrentState(): AppProps {
    return currentState;
}
