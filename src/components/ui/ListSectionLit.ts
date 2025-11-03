import { html, TemplateResult } from 'lit-html';
import classNames from 'classnames';
import { AppProps, ItemProps } from '@/types/props';
import { setSelectedItem, setVisibility } from '@/state/globalState';
import { escapeRegex, insertWordIntoPrompt } from '@/utils/editorUtil';
import { formatNumberWithUnits } from '@/utils/commonUtil';
import { openWiki } from '@/utils/externalUtil';

/**
 * Handle item selection (mousemove)
 * @param e - Mouse event
 * @param items - Filtered items array
 * @param state - Current application state
 */
function handleSelectItemEvent(e: MouseEvent, items: ItemProps[], state: AppProps): void {
    const target = e.target as HTMLElement;
    const element = target.closest('li');
    if (element) {
        const item = items[+element.dataset.index!];
        if (item && (state.selectedItem?.value !== item.value || state.selectedItem.consequentTagModel?.value !== item.consequentTagModel?.value)) {
            setSelectedItem(item);
        }
    }
}

/**
 * Handle item application (mousedown)
 * @param e - Mouse event
 * @param items - Filtered items array
 * @param state - Current application state
 */
function handleApplyItemEvent(e: MouseEvent, items: ItemProps[], state: AppProps): void {
    const target = e.target as HTMLElement;
    const element = target.closest('li');
    if (element) {
        e.stopPropagation();
        const item = items[+element.dataset.index!];
        insertWordIntoPrompt(state);
        if (target instanceof HTMLAnchorElement) {
            const tag = item.isOfficial ? item.value : item.consequentTagModel!.value;
            openWiki(tag);
        }
        setVisibility(false);
    }
}

/**
 * Create highlighted text template
 * @param item - The item to highlight
 * @returns TemplateResult for highlighted text
 */
function createHighlightedText(item: ItemProps): TemplateResult {
    const highlightText = (text: string): (string | TemplateResult)[] => {
        let result: (string | TemplateResult)[] = [text];

        item.matchedWords.forEach((matchedWord, wordIndex) => {
            const escapedWord = escapeRegex(matchedWord.word);
            const regex = new RegExp(`(${escapedWord})`, 'gi');

            const newResult: (string | TemplateResult)[] = [];

            result.forEach((part, partIndex) => {
                if (typeof part === 'string') {
                    const segments = part.split(regex);
                    segments.forEach((segment, segmentIndex) => {
                        if (segmentIndex % 2 === 1) {
                            newResult.push(html`<b key="${wordIndex}-${partIndex}-${segmentIndex}">${segment}</b>`);
                        } else if (segment) {
                            newResult.push(segment);
                        }
                    });
                } else {
                    newResult.push(part);
                }
            });

            result = newResult;
        });

        return result;
    };

    return html`
        ${highlightText(item.value)}
        ${item.consequentTagModel
            ? html`
                  <span></span>
                  ${highlightText(item.consequentTagModel.value)}
              `
            : ''}
    `;
}

/**
 * Create individual item template
 * @param item - The item to render
 * @param index - The item index
 * @param state - Current application state
 * @returns TemplateResult for the item
 */
function createItemTemplate(item: ItemProps, index: number, state: AppProps): TemplateResult {
    const isSelected = state.selectedItem?.value === item.value && state.selectedItem.consequentTagModel?.value === item.consequentTagModel?.value;

    const itemClasses = classNames(`group${item.category}`, isSelected ? 'selected' : '');

    return html`
        <li class="${itemClasses}" data-index="${index}">
            ${state.type === 'tag' ? html`<span class="${classNames('highlight', item.useCount > 0 ? 'recommend' : null)}"></span>` : ''}
            ${state.type === 'tag' ? html` <a class="wiki" style="visibility: ${item.postCount > 0 ? '' : 'hidden'}"> ? </a> ` : ''}
            <span class="title" style="text-decoration: ${item.exists ? 'line-through' : 'undefined'}"> ${createHighlightedText(item)} </span>
            ${state.type === 'tag' && item.postCount > 0 ? html` <span class="post-count">${formatNumberWithUnits(item.postCount)}</span> ` : ''}
        </li>
    `;
}

/**
 * Scroll selected item into view
 * @param state - Current application state
 */
function scrollSelectedItemIntoView(state: AppProps): void {
    if (state.selectedItem) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
            const selectedElement = document.querySelector('#suggestion-box li.selected');
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }, 0);
    }
}

/**
 * Create the items list template using lit-html
 * @param state - Current application state
 * @returns TemplateResult for rendering
 */
export function createItemsTemplate(state: AppProps): TemplateResult {
    const items = state.items.filter((item) => state.selectedCategory === 'all' || String(item.category) === state.selectedCategory);

    // Scroll selected item into view after render
    scrollSelectedItemIntoView(state);

    let message: string | undefined;
    if (state.message) {
        message = state.message;
    }

    return html`
        <ul
            key="${state.selectedCategory}_${message}_${items.length}"
            class="list-container"
            @mousemove="${(e: MouseEvent) => handleSelectItemEvent(e, items, state)}"
            @mousedown="${(e: MouseEvent) => handleApplyItemEvent(e, items, state)}"
        >
            ${message ? html` <li key="${message}" class="notice" data-type="">${message}</li> ` : ''}
            ${!message ? items.map((item, index) => createItemTemplate(item, index, state)) : ''}
        </ul>
    `;
}
