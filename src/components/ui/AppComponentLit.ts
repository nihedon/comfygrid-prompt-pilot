import { html, TemplateResult } from 'lit-html';
import { AppProps } from '@/types/props';
import { TEXTAREA_SELECTOR } from '@/const/common';
import { setTextarea } from '@/state/globalState';
import { setDisplay, setPosition } from '@/helpers/styleHelper';
import { createTabsTemplate } from '@/components/ui/TabsSectionLit';
import { createItemsTemplate } from '@/components/ui/ListSectionLit';
import { createPreviewTemplate } from '@/components/ui/PreviewSectionLit';
import { initializeTextareaEventHandlers } from '@/hooks/useTextareaHandlersLit';
import { initializeApp } from '@/hooks/useInitializationLit';

let isInitialized = false;

/**
 * Handle global click events for textarea detection
 */
function handleClickAnywhere(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest('#suggestion-box')) {
        e.stopPropagation();
        return;
    }
    if (target.matches(TEXTAREA_SELECTOR)) {
        setTextarea(target as PilotTextArea);
    } else {
        setTextarea(null);
    }
    e.stopPropagation();
}

/**
 * Initialize event listeners and setup
 */
function initializeEventListeners(): void {
    if (isInitialized) return;

    // Initialize textarea event handlers
    initializeTextareaEventHandlers();

    // Initialize app
    initializeApp();

    // Add global click handler
    document.addEventListener('mousedown', handleClickAnywhere);

    isInitialized = true;
}

/**
 * Cleanup event listeners
 */
export function cleanupEventListeners(): void {
    if (!isInitialized) return;

    document.removeEventListener('mousedown', handleClickAnywhere);
    isInitialized = false;
}

/**
 * Create the main UI template using lit-html
 * @param state - Current application state
 * @returns TemplateResult for rendering
 */
export function createUITemplate(state: AppProps): TemplateResult {
    // Initialize event listeners on first render
    if (!isInitialized) {
        // Use setTimeout to ensure DOM is ready
        setTimeout(initializeEventListeners, 0);
    }

    const style = {
        ...setPosition(state.pos),
        ...setDisplay(state),
    };

    return html`
        <div
            id="suggestion-box"
            style="${Object.entries(style)
                .map(([key, value]) => `${key}: ${value}`)
                .join('; ')}"
        >
            ${createTabsTemplate(state)} ${createItemsTemplate(state)} ${createPreviewTemplate(state)}
        </div>
    `;
}
