import { createContext } from 'react';
import { emptyFn } from '../../lib/utils';

export type ImageType = 'png' | 'jpeg' | 'svg';
export interface ExportImageContext {
    exportImage: (type: ImageType) => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportJson: (currentDiagram?: any) => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportJsonApi: (currentDiagram?: any) => Promise<void>;
}

export const exportImageContext = createContext<ExportImageContext>({
    exportImage: emptyFn,
    exportJson: emptyFn,
    exportJsonApi: emptyFn,
});
