import { setVisibility, setPosition, setSelectedItem, setParseResult, globalState } from '@/state/globalState';
import * as parser from '@/parsers/promptParser';
import { openWiki } from '@/utils/externalUtil';
import { calcContextPosition } from '@/utils/uiUtil';
import { insertWordIntoPrompt } from '@/utils/editorUtil';
import { ItemProps, Word } from '@/types/props';
import { debounceWithLeadingTrailing } from '@/utils/commonUtil';
import { updateContext } from '@/hooks/usePromptContext';
import { DEBOUNCE_DELAY } from '@/const/common';

const debounceUpdateContext = debounceWithLeadingTrailing((state) => updateContext(state), DEBOUNCE_DELAY);

let processingPromise: Promise<Word> | undefined;
let isWeightMode = false;
let isComposing = false;

type KeyCode = 'Tab' | 'Enter' | 'Backspace' | 'Delete' | 'ArrowDown' | 'ArrowUp' | 'Escape' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/**
 * Handle mouse down event for Ctrl+Click functionality
 */
function handleMouseDown(e: MouseEvent): void {
    if (!window.pilotIsActive) return;

    if (!e.ctrlKey) {
        return;
    }
    // waiting for the textarea to be updated
    setTimeout(() => {
        processingPromise = new Promise((resolve) => {
            const textarea = globalState.textarea!;
            const parseResult = parser.updatePromptState(textarea.value, textarea.selectionEnd);
            setParseResult(parseResult);
            const { promptInfo } = parseResult;
            const activeWord = promptInfo.words[promptInfo.activeWordIndex];
            resolve(activeWord);
        });
    }, 50);
}

/**
 * Handle mouse up event for Ctrl+Click functionality
 */
function handleMouseUp(e: MouseEvent): void {
    if (!window.pilotIsActive) return;

    if (!e.ctrlKey) {
        return;
    }
    if (!processingPromise) {
        return;
    }
    processingPromise.then((word) => {
        if (word.type === 'tag') {
            openWiki(word.value);
        }
    });
}

/**
 * Handle composition start event
 */
function handleCompositionStart(): void {
    if (!window.pilotIsActive) return;

    isComposing = true;
}

/**
 * Handle composition end event
 */
function handleCompositionEnd(): void {
    if (!window.pilotIsActive) return;

    isComposing = false;
    if (!isWeightMode) {
        setPosition(calcContextPosition(globalState));
        debounceUpdateContext(globalState);
    }
}

/**
 * Handle input event
 */
function handleInput(): void {
    if (!window.pilotIsActive) return;

    if (isWeightMode || isComposing) {
        return;
    }
    setPosition(calcContextPosition(globalState));
    debounceUpdateContext(globalState);
}

/**
 * Handle keydown event
 */
function handleKeyDown(e: KeyboardEvent): void {
    if (!window.pilotIsActive) return;

    const key = e.key as KeyCode;
    if (e.ctrlKey && (key === 'ArrowDown' || key === 'ArrowUp')) {
        isWeightMode = true;
        return;
    }

    if (!globalState.isVisible || globalState.parseResult.promptInfo.inputtingString.length === 0) {
        return;
    }
    if (isComposing) {
        return;
    }

    if (!globalState.items.length) {
        return;
    }

    if (key === 'Tab') {
        const itemProps = globalState.selectedItem;
        if (itemProps) {
            const type = globalState.type;
            insertWordIntoPrompt(globalState);
            if (e.shiftKey && type === 'tag') {
                const tagResult = itemProps as ItemProps;
                if (tagResult.isOfficial !== undefined) {
                    const tag = tagResult.isOfficial ? tagResult.value : tagResult.consequentTagModel!.value;
                    openWiki(tag);
                }
            }
        }
        e.preventDefault();
    } else if (key === 'ArrowDown' || key === 'ArrowUp') {
        if (!e.ctrlKey && !e.shiftKey) {
            const direction = key === 'ArrowDown' ? 1 : -1;
            const filteredItems = globalState.items.filter(
                (item) => globalState.selectedCategory === 'all' || String(item.category) === globalState.selectedCategory,
            );

            let currentIndex = -1;
            if (globalState.selectedItem) {
                currentIndex = filteredItems.findIndex((item) => item.value === globalState.selectedItem!.value);
            }

            const nextIndex = (currentIndex + direction + filteredItems.length) % filteredItems.length;
            setSelectedItem(filteredItems[nextIndex]);
            e.preventDefault();
        }
    }
}

/**
 * Handle keyup event
 */
function handleKeyUp(e: KeyboardEvent): void {
    if (!window.pilotIsActive) return;

    isWeightMode = false;

    if (!globalState.isVisible) {
        return;
    }
    if (isComposing) {
        return;
    }
    const key = e.key as KeyCode;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
        setPosition(calcContextPosition(globalState));
        debounceUpdateContext(globalState);
        e.preventDefault();
    }
}

/**
 * Initialize textarea event handlers for lit-html
 */
export function initializeTextareaEventHandlers(): void {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('compositionstart', handleCompositionStart);
    document.addEventListener('compositionend', handleCompositionEnd);
    document.addEventListener('input', handleInput);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
            const key = e.key as KeyCode;
            if (globalState.isVisible && !isComposing && key === 'Escape') {
                setVisibility(false);
                e.preventDefault();
                e.stopPropagation();
            }
        },
        true,
    );
    document.addEventListener('keyup', handleKeyUp);
}
