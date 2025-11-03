import { TagModel } from '@/types/model';

export interface AppProps {
    isVisible: boolean;
    type: 'tag' | 'lora';
    textarea: PilotTextArea | null;
    selectedCategory: string;
    selectedItem: ItemProps | null;
    items: ItemProps[];
    pos: {
        offset_x: number;
        offset_y: number;
        x: number;
        y: number;
    };
    parseResult: ParseResult;
    message: string;
}

export interface ItemProps {
    value: string;
    view: HTMLLIElement | null;
    matchedWords: { word: string; index: number }[];
    category: string;
    exists: boolean;
    useCount: number;
    postCount: number;
    consequentTagModel: TagModel | null;
    isOfficial: boolean;
    previewFile: string | null;
}

export interface Word {
    value: string;
    position: number;
    type: 'tag' | 'lora';
    isActive: boolean;
}

export interface PromptInfo {
    prompt: string;
    caretPosition: number;
    inputtingString: string;
    activeWordIndex: number;
    words: Word[];
}

export interface InsertionInfo {
    isMetaBlock: boolean;
    needPrependComma: boolean;
    needPrependSpace: boolean;
}

export interface ParseResult {
    promptInfo: PromptInfo;
    insertionInfo: InsertionInfo;
}
