import * as db_lora from '@/services/loraService';
import * as db_tag from '@/services/tagService';
import { gunzipSync } from 'fflate';

export const loadModelsData = async () => {
    try {
        const path = new URL(import.meta.url).pathname.split('/', 5).join('/');
        const res = await fetch(`${path}/models.json.gz`);
        if (!res.ok) return { success: false };

        const buffer = new Uint8Array(await res.arrayBuffer());
        const decompressedBuffer = gunzipSync(buffer);
        const jsonString = new TextDecoder('utf-8').decode(decompressedBuffer);
        const resData = JSON.parse(jsonString);

        return { success: true, data: resData };
    } catch (e) {
        console.error(e);
        return { success: false };
    }
};

export const initializeModels = (data: any) => {
    db_tag.initializeTagModels(data);
    db_lora.initializeLoraModels(data);
};
