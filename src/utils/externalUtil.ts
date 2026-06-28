import { EXTENSION_ID } from '@/const/common';

export const openWiki = (title: string) => {
    if (title) {
        title = title.replace(' ', '_');
        if (new RegExp(/^\d+$/).test(title)) {
            title = `~${title}`;
        }
        if (title.startsWith('@')) {
            title = title.substring(1);
        }
        const domain = opts[`${EXTENSION_ID}_tag_source`] as string;
        window.open(`https://${domain}/wiki_pages/${encodeURIComponent(title)}`);
    }
};
