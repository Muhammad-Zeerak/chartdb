import React, { useCallback, useMemo } from 'react';
import { TableList } from './table-list/table-list';
import { Button } from '../../../../components/button/button';
import { Table, ListCollapse } from 'lucide-react';
import { Input } from '../../../../components/input/input';

import {
    DBTable,
    shouldShowTablesBySchemaFilter,
} from '../../../../lib/domain/db-table';
import { useChartDB } from '../../../../hooks/use-chartdb';
import { useLayout } from '../../../../hooks/use-layout';
import { EmptyState } from '../../../../components/empty-state/empty-state';
import { ScrollArea } from '../../../../components/scroll-area/scroll-area';
import { useTranslation } from 'react-i18next';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '../../../../components/tooltip/tooltip';
import { useViewport } from '@xyflow/react';

export interface TablesSectionProps {}

export const TablesSection: React.FC<TablesSectionProps> = () => {
    const { createTable, tables, filteredSchemas } = useChartDB();
    const viewport = useViewport();
    const { t } = useTranslation();
    const { closeAllTablesInSidebar, openTableFromSidebar } = useLayout();
    const [filterText, setFilterText] = React.useState('');

    const filteredTables = useMemo(() => {
        const filterTableName: (table: DBTable) => boolean = (table) =>
            !filterText?.trim?.() ||
            table.name.toLowerCase().includes(filterText.toLowerCase());

        const filterSchema: (table: DBTable) => boolean = (table) =>
            shouldShowTablesBySchemaFilter(table, filteredSchemas);

        return tables.filter(filterSchema).filter(filterTableName);
    }, [tables, filterText, filteredSchemas]);

    const handleCreateTable = useCallback(async () => {
        setFilterText('');
        const padding = 80;
        const centerX = -viewport.x / viewport.zoom + padding / viewport.zoom;
        const centerY = -viewport.y / viewport.zoom + padding / viewport.zoom;

        const table = await createTable({
            x: centerX,
            y: centerY,
        });
        openTableFromSidebar(table.id);
    }, [
        createTable,
        openTableFromSidebar,
        setFilterText,
        viewport.x,
        viewport.y,
        viewport.zoom,
    ]);

    return (
        <section
            className="flex flex-1 flex-col overflow-hidden px-2"
            data-vaul-no-drag
        >
            <div className="flex items-center justify-between gap-4 py-1">
                <div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    variant="ghost"
                                    className="size-8 p-0"
                                    onClick={closeAllTablesInSidebar}
                                >
                                    <ListCollapse className="size-4" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            {t('side_panel.tables_section.collapse')}
                        </TooltipContent>
                    </Tooltip>
                </div>
                <div className="flex-1">
                    <Input
                        type="text"
                        placeholder={t('side_panel.tables_section.filter')}
                        className="h-8 w-full focus-visible:ring-0"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                </div>
                <Button
                    variant="secondary"
                    className="h-8 p-2 text-xs"
                    onClick={handleCreateTable}
                >
                    <Table className="h-4" />
                    {t('side_panel.tables_section.add_table')}
                </Button>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
                <ScrollArea className="h-full">
                    {tables.length === 0 ? (
                        <EmptyState
                            title={t(
                                'side_panel.tables_section.empty_state.title'
                            )}
                            description={t(
                                'side_panel.tables_section.empty_state.description'
                            )}
                            className="mt-20"
                        />
                    ) : (
                        <TableList tables={filteredTables} />
                    )}
                </ScrollArea>
            </div>
        </section>
    );
};
