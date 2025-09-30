import { BasePlugin } from '../core/BasePlugin';
import type { CellCommand, RowCommand, RowCommandMap } from '../core/types';
import { Indexer } from '../core/Indexer';

export class PerformancePlugin extends BasePlugin {
    name = 'performance-plugin';
    version = '1.0.0';
    dependencies: string[] = [];
    processLast = true; // Load after table space is initialized

    onBeforeCellCommand(_command: CellCommand): boolean | void {
        // Allow all cell commands
        return true;
    }

    onBeforeRowCommand<K extends keyof RowCommandMap>(_command: RowCommand<K>): boolean | void {
        // Allow all row commands
        return true;
    }

    onInit(): void {

        if (this.tableAPIs) {
            // Add small delay to ensure table space is fully ready
            const startTime = performance.now();


            const rowCount = 5000;
            const batchSize = 100; // Process in batches to avoid blocking UI

            this.createRowsBatch(0, rowCount, batchSize, startTime);

        } else {
            console.error(`❌ ${this.name}: No tableAPIs available in onInit`);
        }
    }

    private createRowsBatch(currentIndex: number, totalRows: number, batchSize: number, startTime: number): void {
        const endIndex = Math.min(currentIndex + batchSize, totalRows);

        // Create batch of rows with error handling
        for (let i = currentIndex; i < endIndex; i++) {
            try {
                const rowData = {
                    name: `Performance Row ${i + 1}`,
                    age: Math.floor(Math.random() * 80) + 18,
                    email: `perf${i + 1}@example.com`
                };

                this.tableAPIs!.createRow(rowData, 'bottom');
            } catch (error) {
                console.error(`Failed to create row ${i + 1}:`, error);
                // Continue with next row even if one fails
            }
        }

        console.log(":::::::::::::::::::", Indexer.getLongestIndexLength());
        console.log(`📊 ${this.name}: Created rows ${currentIndex + 1}-${endIndex} of ${totalRows}`);

        // Only render periodically to reduce race conditions (every 500 rows or at the end)
        if (endIndex % 500 === 0 || endIndex >= totalRows) {
            try {
                const mySpaceId = this.tableAPIs!.getMySpace();
                this.tableAPIs!.renderSpace(mySpaceId);
            } catch (error) {
                console.error(`Failed to render space after batch ${endIndex}:`, error);
            }
        }

        // Continue with next batch if there are more rows
        if (endIndex < totalRows) {
            // Use requestAnimationFrame for better performance and lower collision chance
            requestAnimationFrame(() => {
                this.createRowsBatch(endIndex, totalRows, batchSize, startTime);
            });
        } else {
            // All rows created - final render
            const endTime = performance.now();
            console.log(`✅ Performance Plugin: Created all ${totalRows} rows in ${endTime - startTime}ms`);

            // Final render to ensure all rows are visible
            try {
                const mySpaceId = this.tableAPIs!.getMySpace();
                this.tableAPIs!.renderSpace(mySpaceId);
            } catch (error) {
                console.error(`Failed to render space in final render:`, error);
            }
        }
    }

    onDestroy(): void {
        // Plugin cleanup
    }
}
