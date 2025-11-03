import { html, TemplateResult } from 'lit-html';
import { AppProps } from '@/types/props';

/**
 * Create the preview template using lit-html
 * @param state - Current application state
 * @returns TemplateResult for rendering
 */
export function createPreviewTemplate(state: AppProps): TemplateResult {
    if (!(state.selectedItem && state.type === 'lora')) {
        return html``;
    }

    const previewFile = state.selectedItem.previewFile;
    if (!previewFile) {
        return html``;
    }

    return html`
        <div class="preview">
            <img src="${previewFile}" alt="Preview" />
        </div>
    `;
}
