import { TEXTAREA_SELECTOR } from '@/const/common';
import { initialize, renderApp } from '@/components/core/AppLit';

declare function onUiLoaded(callback: VoidFunction): void;
declare function onLayoutChanged(callback: VoidFunction): void;

window.pilotIsActive = true;

let promptPilotStyleSheet: CSSStyleSheet | null = null;
const REQUIRED_PROPERTIES = [
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'letter-spacing',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'border-top-style',
    'border-right-style',
    'border-bottom-style',
    'border-left-style',
    'box-sizing',
    'text-align',
    'text-transform',
    'word-wrap',
    'word-break',
    'white-space',
    'overflow-x',
    'overflow-y',
    'scrollbar-gutter',
    'display',
];

onUiLoaded(() => {
    initialize({
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
    });
});

onLayoutChanged(() => {
    document.getElementById('prompt-pilot-container')?.remove();
    document.querySelectorAll('.prompt_pilot-dummy')?.forEach((el) => el.remove());

    const promptPilotContainer = document.createElement('div');
    promptPilotContainer.id = 'prompt-pilot-container';
    document.body.appendChild(promptPilotContainer);

    const promptTextareas = document.querySelectorAll<HTMLTextAreaElement>(TEXTAREA_SELECTOR);
    if (promptTextareas.length == 0) {
        return;
    }
    const computedStyle = getComputedStyle(promptTextareas[0]);
    const cssStyleString = REQUIRED_PROPERTIES.map((prop) => `${prop}: ${computedStyle.getPropertyValue(prop)};`).join(' ');

    promptTextareas.forEach((_textarea) => {
        const textarea = _textarea as PilotTextArea;
        const dummyDiv = document.createElement('div') as HTMLDivElement & { caret: HTMLSpanElement };
        dummyDiv.className = 'prompt_pilot-dummy';
        textarea.parentNode?.insertBefore(dummyDiv, textarea.nextSibling);
        textarea.dummy = dummyDiv;

        const caretSpan = document.createElement('span');
        dummyDiv.caret = caretSpan;
    });

    if (!promptPilotStyleSheet) {
        promptPilotStyleSheet = new CSSStyleSheet();
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, promptPilotStyleSheet];
    }
    promptPilotStyleSheet.replaceSync(`.prompt_pilot-dummy {${cssStyleString}}`);

    // Initial render
    renderApp();
});
