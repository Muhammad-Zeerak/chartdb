import React, { useCallback, useMemo } from 'react';
import {
    ExportImageContext,
    exportImageContext,
    ImageType,
} from './export-image-context';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import {
    getNodesBounds,
    getViewportForBounds,
    useReactFlow,
} from '@xyflow/react';
import { useChartDB } from '@/hooks/use-chartdb';
import { useFullScreenLoader } from '@/hooks/use-full-screen-spinner';

const imageWidth = 1024;
const imageHeight = 768;

export const ExportImageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const { hideLoader, showLoader } = useFullScreenLoader();
    const { getNodes, setNodes } = useReactFlow();
    const { diagramName } = useChartDB();

    const downloadImage = useCallback(
        (dataUrl: string, type: ImageType) => {
            const a = document.createElement('a');

            a.setAttribute('download', `${diagramName}.${type}`);
            a.setAttribute('href', dataUrl);

            a.click();
        },
        [diagramName]
    );

    const imageCreatorMap: Record<
        ImageType,
        typeof toJpeg | typeof toPng | typeof toSvg
    > = useMemo(
        () => ({
            jpeg: toJpeg,
            png: toPng,
            svg: toSvg,
        }),
        []
    );

    const exportImage: ExportImageContext['exportImage'] = useCallback(
        async (type) => {
            showLoader({
                animated: false,
            });

            setNodes((nodes) =>
                nodes.map((node) => ({ ...node, selected: false }))
            );

            const nodesBounds = getNodesBounds(getNodes());
            const viewport = getViewportForBounds(
                nodesBounds,
                imageWidth,
                imageHeight,
                0.01,
                2,
                0.02
            );

            const imageCreateFn = imageCreatorMap[type];

            setTimeout(async () => {
                const dataUrl = await imageCreateFn(
                    window.document.querySelector(
                        '.react-flow__viewport'
                    ) as HTMLElement,
                    {
                        ...(type === 'jpeg' || type === 'png'
                            ? { backgroundColor: '#ffffff' }
                            : {}),
                        width: imageWidth,
                        height: imageHeight,
                        style: {
                            width: `${imageWidth}px`,
                            height: `${imageHeight}px`,
                            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                        },
                        quality: 1,
                    }
                );

                downloadImage(dataUrl, type);
                hideLoader();
            }, 0);
        },
        [
            downloadImage,
            getNodes,
            imageCreatorMap,
            setNodes,
            showLoader,
            hideLoader,
        ]
    );

    function transformDiagram(diagram: any) {
        const result = diagram.tables.map((table: any) => {
            const columns = table.fields.map((field: any) => ({
                name: field.name,
                type: field.type.name.toUpperCase(),
                required: !field.nullable,
                primaryKey: field.primaryKey,
            }));

            const foreignKeys = diagram.relationships
                .filter((rel: any) => rel.targetTableId === table.id)
                .map((rel: any) => {
                    let relationshipType = '';

                    if (
                        rel.sourceCardinality === 'many' &&
                        rel.targetCardinality === 'one'
                    ) {
                        relationshipType = 'one-to-many';
                    } else if (
                        rel.sourceCardinality === 'one' &&
                        rel.targetCardinality === 'many'
                    ) {
                        relationshipType = 'many-to-one';
                    } else if (
                        rel.sourceCardinality === 'one' &&
                        rel.targetCardinality === 'one'
                    ) {
                        relationshipType = 'one-to-one';
                    } else if (
                        rel.sourceCardinality === 'many' &&
                        rel.targetCardinality === 'many'
                    ) {
                        relationshipType = 'many-to-many';
                    }

                    return {
                        type: relationshipType,
                        referenced_table:
                            diagram.tables.find(
                                (t: any) => t.id === rel.sourceTableId
                            )?.name || '',
                        referenced_column:
                            diagram.tables
                                .find((t: any) => t.id === rel.sourceTableId)
                                ?.fields.find(
                                    (f: any) => f.id === rel.sourceFieldId
                                )?.name || '',
                        referencing_column:
                            table.fields.find(
                                (f: any) => f.id === rel.targetFieldId
                            )?.name || '',
                    };
                });

            return {
                tableName: table.name,
                name: table.name,
                auditable: table.auditable,
                revisionEnabled: table.revisionEnabled,
                entityDefinition: {
                    columns: columns,
                },
                foreignKeys: foreignKeys,
            };
        });

        return result;
    }

    const exportJson: ExportImageContext['exportJson'] = useCallback(
        async (type, currentDiagram) => {
            if (type === 'json') {
                const transformedDiagram = transformDiagram(currentDiagram);

                const jsonData = JSON.stringify(transformedDiagram, null, 2);
                const blob = new Blob([jsonData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.setAttribute('download', `${diagramName}.json`);
                a.setAttribute('href', url);
                a.click();

                URL.revokeObjectURL(url);
                return;
            }
        },
        [diagramName]
    );

    return (
        <exportImageContext.Provider value={{ exportImage, exportJson }}>
            {children}
        </exportImageContext.Provider>
    );
};
