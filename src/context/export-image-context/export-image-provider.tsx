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
import { useChartDB } from '../../hooks/use-chartdb';
import { useFullScreenLoader } from '../../hooks/use-full-screen-spinner';
import tokenManager from './tokenManager';

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

    const typeMapping: Record<string, string> = {
        bigint: 'INT',
        binary: 'STRING',
        blob: 'STRING',
        boolean: 'BOOLEAN',
        char: 'STRING',
        date: 'DATE',
        datetime: 'DATE',
        decimal: 'FLOAT',
        double: 'FLOAT',
        enum: 'STRING',
        float: 'FLOAT',
        int: 'INT',
        json: 'STRING',
        numeric: 'FLOAT',
        real: 'FLOAT',
        set: 'STRING',
        smallint: 'INT',
        text: 'TEXT',
        time: 'DATE',
        timestamp: 'DATE',
        uuid: 'STRING',
        varbinary: 'STRING',
        varchar: 'STRING',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function transformDiagram(diagram: any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = diagram.tables.map((table: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const columns = table.fields.map((field: any) => ({
                name: field.name,
                type: typeMapping[field.type.name] || 'STRING',
                required: !field.nullable,
                primaryKey: field.primaryKey,
            }));

            const foreignKeys = diagram.relationships
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((rel: any) => rel.targetTableId === table.id)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (t: any) => t.id === rel.sourceTableId
                            )?.name || '',
                        referenced_column:
                            diagram.tables
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .find((t: any) => t.id === rel.sourceTableId)
                                ?.fields.find(
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    (f: any) => f.id === rel.sourceFieldId
                                )?.name || '',
                        referencing_column:
                            table.fields.find(
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        async (currentDiagram) => {
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
        },
        [diagramName]
    );



    const exportJsonApi: ExportImageContext['exportJsonApi'] = useCallback(
        async (currentDiagram) => {
            const transformedDiagram = transformDiagram(currentDiagram);
            const jsonData = JSON.stringify(transformedDiagram, null, 2);

            try {
                const token = tokenManager.getToken();
                const response = await fetch(
                    'http://124.109.36.79:8080/api/v1/entity/bulk',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: jsonData,
                    }
                );

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const responseData = await response.json();
                console.log('Success:', responseData);
            } catch (error) {
                console.error('Error:', error);
            }

            return;
        },
        [diagramName]
    );

    return (
        <exportImageContext.Provider
            value={{ exportImage, exportJson, exportJsonApi }}
        >
            {children}
        </exportImageContext.Provider>
    );
};
