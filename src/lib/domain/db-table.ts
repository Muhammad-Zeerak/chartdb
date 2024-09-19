import { DBIndex } from './db-index';
import { DBField } from './db-field';
import { TableInfo } from '../data/import-metadata/metadata-types/table-info';
import { ColumnInfo } from '../data/import-metadata/metadata-types/column-info';
import { IndexInfo } from '../data/import-metadata/metadata-types/index-info';
import { greyColor, randomColor } from '@/lib/colors';
import { DBRelationship } from './db-relationship';
import { PrimaryKeyInfo } from '../data/import-metadata/metadata-types/primary-key-info';
import { ViewInfo } from '../data/import-metadata/metadata-types/view-info';
import { deepCopy, generateId } from '../utils';
import {
    schemaNameToDomainSchemaName,
    schemaNameToSchemaId,
} from './db-schema';

export interface DBTable {
    id: string;
    name: string;
    schema?: string;
    x: number;
    y: number;
    fields: DBField[];
    indexes: DBIndex[];
    color: string;
    isView: boolean;
    createdAt: number;
    width?: number;
    comments?: string;
    hidden?: boolean;
    auditable: boolean;
    revisionEnabled: boolean;
}

export const shouldShowTablesBySchemaFilter = (
    table: DBTable,
    filteredSchemas?: string[]
): boolean =>
    !filteredSchemas ||
    !table.schema ||
    filteredSchemas.includes(schemaNameToSchemaId(table.schema));

export const createTablesFromMetadata = ({
    tableInfos,
    columns,
    indexes,
    primaryKeys,
    views,
}: {
    tableInfos: TableInfo[];
    columns: ColumnInfo[];
    indexes: IndexInfo[];
    primaryKeys: PrimaryKeyInfo[];
    views: ViewInfo[];
}): DBTable[] => {
    return tableInfos.map((tableInfo: TableInfo) => {
        const tableSchema = schemaNameToDomainSchemaName(tableInfo.schema);
        // Filter, make unique, and sort columns based on ordinal_position
        const uniqueColumns = new Map<string, ColumnInfo>();
        columns
            .filter(
                (col) =>
                    schemaNameToDomainSchemaName(col.schema) === tableSchema &&
                    col.table === tableInfo.table
            )
            .forEach((col) => {
                if (!uniqueColumns.has(col.name)) {
                    uniqueColumns.set(col.name, col);
                }
            });

        const sortedColumns = Array.from(uniqueColumns.values()).sort(
            (a, b) => a.ordinal_position - b.ordinal_position
        );

        const tablePrimaryKeys = primaryKeys
            .filter(
                (pk) =>
                    pk.table === tableInfo.table &&
                    schemaNameToDomainSchemaName(pk.schema) === tableSchema
            )
            .map((pk) => pk.column.trim());

        const tableIndexes = indexes.filter((idx) => {
            const indexSchema = schemaNameToDomainSchemaName(idx.schema);

            return idx.table === tableInfo.table && indexSchema === tableSchema;
        });

        // Aggregate indexes with multiple columns
        const aggregatedIndexes = tableIndexes.reduce(
            (acc, idx) => {
                const key = `${idx.schema}_${idx.name}`;
                if (!acc[key]) {
                    acc[key] = {
                        ...idx,
                        columns: [
                            { name: idx.column, position: idx.column_position },
                        ],
                    };
                } else {
                    acc[key].columns.push({
                        name: idx.column,
                        position: idx.column_position,
                    });
                }
                return acc;
            },
            {} as Record<
                string,
                Omit<IndexInfo, 'column'> & {
                    columns: { name: string; position: number }[];
                }
            >
        );

        const fields: DBField[] = sortedColumns.map(
            (col: ColumnInfo): DBField => ({
                id: generateId(),
                name: col.name,
                type: { id: col.type.split(' ').join('_'), name: col.type },
                primaryKey: tablePrimaryKeys.includes(col.name),
                unique: Object.values(aggregatedIndexes).some(
                    (idx) =>
                        idx.unique &&
                        idx.columns.length === 1 &&
                        idx.columns[0].name === col.name
                ),
                nullable: col.nullable,
                ...(col.character_maximum_length &&
                col.character_maximum_length !== 'null'
                    ? { character_maximum_length: col.character_maximum_length }
                    : {}),
                ...(col.precision?.precision
                    ? { precision: col.precision.precision }
                    : {}),
                ...(col.precision?.scale ? { scale: col.precision.scale } : {}),
                ...(col.default ? { default: col.default } : {}),
                ...(col.collation ? { collation: col.collation } : {}),
                createdAt: Date.now(),
                comments: col.comment ? col.comment : undefined,
            })
        );

        const dbIndexes: DBIndex[] = Object.values(aggregatedIndexes).map(
            (idx): DBIndex => ({
                id: generateId(),
                name: idx.name,
                unique: idx.unique,
                fieldIds: idx.columns
                    .sort((a, b) => a.position - b.position)
                    .map((c) => fields.find((f) => f.name === c.name)?.id)
                    .filter((id): id is string => id !== undefined),
                createdAt: Date.now(),
            })
        );

        // Determine if the current table is a view by checking against viewInfo
        const isView = views.some(
            (view) =>
                schemaNameToDomainSchemaName(view.schema) === tableSchema &&
                view.view_name === tableInfo.table
        );

        // Initial random positions; these will be adjusted later
        return {
            id: generateId(),
            name: tableInfo.table,
            schema: tableSchema,
            x: Math.random() * 1000, // Placeholder X
            y: Math.random() * 800, // Placeholder Y
            fields,
            indexes: dbIndexes,
            color: isView ? greyColor : randomColor(),
            isView: isView,
            createdAt: Date.now(),
            comments: tableInfo.comment ? tableInfo.comment : undefined,
            auditable: tableInfo.auditable,
            revisionEnabled: tableInfo.revisionEnabled,
        };
    });
};

export const adjustTablePositions = ({
    relationships: inputRelationships,
    tables: inputTables,
}: {
    tables: DBTable[];
    relationships: DBRelationship[];
}): DBTable[] => {
    const tables = deepCopy(inputTables);
    const relationships = deepCopy(inputRelationships);

    // Filter relationships to only include those between filtered tables
    const filteredRelationships = relationships.filter(
        (rel) =>
            tables.some((t) => t.id === rel.sourceTableId) &&
            tables.some((t) => t.id === rel.targetTableId)
    );

    const tableWidth = 200;
    const tableHeight = 300;
    const gapX = 100;
    const gapY = 100;
    const startX = 100;
    const startY = 100;

    // Create a map of table connections
    const tableConnections = new Map<string, Set<string>>();
    filteredRelationships.forEach((rel) => {
        if (!tableConnections.has(rel.sourceTableId)) {
            tableConnections.set(rel.sourceTableId, new Set());
        }
        if (!tableConnections.has(rel.targetTableId)) {
            tableConnections.set(rel.targetTableId, new Set());
        }
        tableConnections.get(rel.sourceTableId)!.add(rel.targetTableId);
        tableConnections.get(rel.targetTableId)!.add(rel.sourceTableId);
    });

    // Sort tables by number of connections
    const sortedTables = [...tables].sort(
        (a, b) =>
            (tableConnections.get(b.id)?.size || 0) -
            (tableConnections.get(a.id)?.size || 0)
    );

    const positionedTables = new Set<string>();
    const tablePositions = new Map<string, { x: number; y: number }>();

    const isOverlapping = (
        x: number,
        y: number,
        currentTableId: string
    ): boolean => {
        for (const [tableId, pos] of tablePositions) {
            if (tableId === currentTableId) continue;
            if (
                Math.abs(x - pos.x) < tableWidth + gapX &&
                Math.abs(y - pos.y) < tableHeight + gapY
            ) {
                return true;
            }
        }
        return false;
    };

    const findNonOverlappingPosition = (
        baseX: number,
        baseY: number,
        tableId: string
    ): { x: number; y: number } => {
        const spiralStep = Math.max(tableWidth, tableHeight) / 2;
        let angle = 0;
        let radius = 0;
        let iterations = 0;
        const maxIterations = 1000; // Prevent infinite loop

        while (iterations < maxIterations) {
            const x = baseX + radius * Math.cos(angle);
            const y = baseY + radius * Math.sin(angle);
            if (!isOverlapping(x, y, tableId)) {
                return { x, y };
            }
            angle += Math.PI / 4;
            if (angle >= 2 * Math.PI) {
                angle = 0;
                radius += spiralStep;
            }
            iterations++;
        }

        // If we can't find a non-overlapping position, return a position far from others
        return {
            x: baseX + radius * Math.cos(angle),
            y: baseY + radius * Math.sin(angle),
        };
    };

    const positionTable = (table: DBTable, baseX: number, baseY: number) => {
        if (positionedTables.has(table.id)) return;

        const { x, y } = findNonOverlappingPosition(baseX, baseY, table.id);

        table.x = x;
        table.y = y;
        tablePositions.set(table.id, { x: table.x, y: table.y });
        positionedTables.add(table.id);

        // Position connected tables
        const connectedTables = tableConnections.get(table.id) || new Set();
        let angle = 0;
        const angleStep = (2 * Math.PI) / connectedTables.size;

        connectedTables.forEach((connectedTableId) => {
            if (!positionedTables.has(connectedTableId)) {
                const connectedTable = tables.find(
                    (t) => t.id === connectedTableId
                );
                if (connectedTable) {
                    const newX = x + Math.cos(angle) * (tableWidth + gapX * 2);
                    const newY = y + Math.sin(angle) * (tableHeight + gapY * 2);
                    positionTable(connectedTable, newX, newY);
                    angle += angleStep;
                }
            }
        });
    };

    // Position tables
    sortedTables.forEach((table, index) => {
        if (!positionedTables.has(table.id)) {
            const row = Math.floor(index / 6);
            const col = index % 6;
            const x = startX + col * (tableWidth + gapX * 2);
            const y = startY + row * (tableHeight + gapY * 2);
            positionTable(table, x, y);
        }
    });

    // Apply positions to filtered tables
    tables.forEach((table) => {
        const position = tablePositions.get(table.id);
        if (position) {
            table.x = position.x;
            table.y = position.y;
        }
    });

    return tables; // Return all tables, but only filtered ones are positioned
};
