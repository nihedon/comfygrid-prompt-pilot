import { loadModelsData, initializeModels } from '@/services/initializationService';
import { EXTENSION_ID } from '@/const/common';

declare function onOptionsChanged(callback: VoidFunction): void;

export let resolveInitialized: ((value: boolean) => void) | null;
const initializedPromise = new Promise<boolean>((resolve) => {
    resolveInitialized = resolve;
});

onOptionsChanged(() => {
    window.pilotIsActive = opts[`${EXTENSION_ID}_enabled`] as boolean;
    if (resolveInitialized) {
        resolveInitialized(true);
        resolveInitialized = null;
    }
});

/**
 * Initialize the application for lit-html
 */
export function initializeApp(): void {
    const initialize = async () => {
        const result = await loadModelsData();
        if (result.success) {
            try {
                await initializedPromise;
                initializeModels(result.data);
            } catch (e) {
                console.error(e);
            }
        }
    };

    initialize();
}
