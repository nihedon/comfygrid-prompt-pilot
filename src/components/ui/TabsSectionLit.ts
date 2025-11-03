import { html, TemplateResult } from 'lit-html';
import classNames from 'classnames';
import { AppProps } from '@/types/props';
import { setTab } from '@/state/globalState';

/**
 * Handle tab selection
 * @param category - The category to select
 */
function handleSelectTab(category: string): void {
    setTab(category);
}

/**
 * Create the tabs template using lit-html
 * @param state - Current application state
 * @returns TemplateResult for rendering
 */
export function createTabsTemplate(state: AppProps): TemplateResult {
    const tabDefines = [
        ['all', 'ALL'],
        ['0', 'Gen'],
        ['1', 'Art'],
        ['3', 'Copy'],
        ['4', 'Chara'],
        ['5', 'Meta'],
    ];

    return html`
        <div class="${classNames('tab-container', state.type === 'tag' ? '' : 'no-tab')}">
            ${tabDefines.map(
                ([category, title]) => html`
                    <div
                        class="${classNames('tab', `group${category}`, state.selectedCategory === category ? 'selected' : '')}"
                        @click="${() => handleSelectTab(category)}"
                    >
                        ${title}
                    </div>
                `,
            )}
        </div>
    `;
}
