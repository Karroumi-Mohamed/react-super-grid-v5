import { generateKeyBetween } from "fractional-indexing";

export class Indexer {
    private static idCounter = 0;
    private static indexMap: Map<string, string> = new Map();

    private static longestIndexLength = 0;

    // private static stats = {
    //     additions: 0,
    //     redistributions: 0,
    // };

    public static above(belowId?: string): string {
        const belowIndex = belowId ? this.indexMap.get(belowId) : null;
        const newIndex = generateKeyBetween(belowIndex, null);
        const newId = `IDX_${this.idCounter++}`;
        if (newIndex.length > this.longestIndexLength) {
            this.longestIndexLength = newIndex.length;
            Indexer.checkAndRedistribute();
        }
        this.indexMap.set(newId, newIndex);
        return newId;
    }

    public static below(aboveId?: string): string {
        const aboveIndex = aboveId ? this.indexMap.get(aboveId) : null;
        const newIndex = generateKeyBetween(null, aboveIndex);
        const newId = `IDX_${this.idCounter++}`;
        if (newIndex.length > this.longestIndexLength) {
            this.longestIndexLength = newIndex.length;
            Indexer.checkAndRedistribute();
        }
        this.indexMap.set(newId, newIndex);
        return newId;
    }

    public static between(lowerIndex: string, upperIndex: string): string {
        const belowValue = this.indexMap.get(lowerIndex);
        const aboveValue = this.indexMap.get(upperIndex);

        if (!belowValue || !aboveValue) {
            throw new Error("Invalid index references provided.");
        }

        // Add debug logging for index comparison issues
        if (belowValue >= aboveValue) {
            console.error(`❌ Indexer.between() ordering error:`, {
                lowerIndex,
                belowValue,
                upperIndex,
                aboveValue,
                comparison: belowValue.localeCompare(aboveValue)
            });
            throw new Error(`Below must be less than above (below: ${belowValue}, above: ${aboveValue})`);
        }

        const newIndex = generateKeyBetween(belowValue, aboveValue);

        const indexRef = `IDX_${this.idCounter++}`;

        if (newIndex.length > this.longestIndexLength) {
            this.longestIndexLength = newIndex.length;
            Indexer.checkAndRedistribute();
        }

        this.indexMap.set(indexRef, newIndex);
        return indexRef;
    }

    public static getSortedRefs(): string[] {
        return [...this.indexMap.entries()]
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([ref]) => ref);
    }

    public static clear(): void {
        this.indexMap.clear();
        this.idCounter = 0;
    }

    public static compare(refA: string, refB: string): number {
        const indexA = this.indexMap.get(refA);
        const indexB = this.indexMap.get(refB);

        if (!indexA || !indexB) {
            throw new Error("Invalid index references provided.");
        }

        return indexA.localeCompare(indexB);
    }

    public static checkAndRedistribute(): void {
        if (this.longestIndexLength >= 400) {
            this.redistributeIndices();
        }
    }
    public static getLongestIndexLength(): number {
        return this.longestIndexLength;
    }

    private static redistributeIndices(): void {
        return;
        const ids = this.getSortedRefs();
        this.indexMap.clear();
        this.idCounter = 0;
        this.longestIndexLength = 0;
        let start = true;
        let prevIndex: string = "";
        for (const id of ids) {
            const newIndex = start ? generateKeyBetween(null, null) : generateKeyBetween(prevIndex, null);
            this.indexMap.set(id, newIndex);
            prevIndex = newIndex;
            start = false;
        }
    }

    public static getIndex(ref: string): string | undefined {
        return this.indexMap.get(ref);
    }
}
