import { createContext } from 'react';
import { emptyFn } from '@/lib/utils';

export type ImageType = 'png' | 'jpeg' | 'svg' | 'json';
export interface ExportImageContext {
    exportImage: (type: ImageType) => Promise<void>;
    exportJson: (type: ImageType, currentDiagram?: any) => Promise<void>;
}

export const exportImageContext = createContext<ExportImageContext>({
    exportImage: emptyFn,
    exportJson: emptyFn,
});
