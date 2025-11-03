import * as parser from '@/parsers/promptParser';
import { AppProps, PromptInfo } from '@/types/props';
import * as db_tag from '@/services/tagService';
import * as db_lora from '@/services/loraService';
import { setItems, setMessage, setParseResult } from '@/state/globalState';

/**
 * Extract prompt information from current state
 * @param state - Current application state
 * @returns Parse result containing prompt info
 */
function extractPromptInfo(state: AppProps) {
    const textarea = state.textarea;
    if (!textarea) {
        return null;
    }
    const parseResult = parser.updatePromptState(textarea.value, textarea.selectionEnd);

    return parseResult;
}

/**
 * Collect existing tags from prompt, excluding the active word
 * @param promptInfo - Current prompt information
 * @returns Set of existing tag values
 */
function collectExistingTags(promptInfo: PromptInfo): Set<string> {
    return new Set(promptInfo.words.filter((word, i) => i !== promptInfo.activeWordIndex && word.type !== 'lora').map((word) => word.value));
}

/**
 * Handle tag item search and updates
 * @param inputtingString - Current input string
 * @param existTags - Set of existing tags
 */
function handleTagItems(inputtingString: string, existTags: Set<string>) {
    if (inputtingString === '') {
        return;
    }

    if (inputtingString.startsWith('*') && inputtingString.length > 1) {
        db_tag.debounceSearchWithApi(inputtingString.substring(1), (resultSet) => {
            setItems('tag', resultSet);
        });
        setMessage('tag', 'Searching for tags via API...');
    } else {
        const items = db_tag.searchTag(inputtingString);
        items.forEach((item) => {
            if (existTags.has(item.value.replaceAll('_', ' '))) {
                item.exists = true;
            }
        });
        setItems('tag', items);
    }
}

/**
 * Handle LoRA item search and updates
 * @param inputtingString - Current input string
 */
function handleLoraItems(inputtingString: string) {
    const items = db_lora.searchLora(inputtingString);
    setItems('lora', items);
}

/**
 * Update context based on current state
 * @param state - Current application state
 */
export function updateContext(state: AppProps) {
    const parseResult = extractPromptInfo(state);
    if (!parseResult) {
        return;
    }

    setParseResult(parseResult);

    const { promptInfo } = parseResult;

    const activeWord = promptInfo.words[promptInfo.activeWordIndex];
    const inputtingString = promptInfo.inputtingString;

    const existTags = collectExistingTags(promptInfo);

    if (activeWord.type === 'lora') {
        handleLoraItems(inputtingString);
    } else {
        handleTagItems(inputtingString, existTags);
    }
}
