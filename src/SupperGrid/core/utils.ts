export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Generates a lexicographically-ordered string between two given strings.
 * Optimized for better distribution and shorter strings.
 */
export function getOrderIndex(above: string | null, below: string): string {
    let aboveNum = Number.parseFloat(above!);
    let belowNum = Number.parseFloat(below);
    if (above === null) {
       return (belowNum + 10).toString()
    }

    return ((aboveNum + belowNum) / 2).toString()
}
export const CompareResult = {
    BELOW: -1,
    SAME: 0,
    ABOVE: 1
} as const;
export type CompareResult = typeof CompareResult[keyof typeof CompareResult];

export const OrderDirection = {
    TOP_TO_BOTTOM: 'top-to-bottom',  // Normal: smaller index = above
    BOTTOM_TO_TOP: 'bottom-to-top'   // Inverted: larger index = above
} as const;
export type OrderDirection = typeof OrderDirection[keyof typeof OrderDirection];

class Indexer {
    private static readonly ascii = "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~";
    private static readonly base = Indexer.ascii.length;

    // Internal mapping: short ID -> full index
    // Map is better here because:
    // 1. O(1) lookups by ID (your main use case)
    // 2. No need for range queries
    // 3. Simpler implementation
    // 4. Better memory locality for small-medium datasets
    private static indexMap = new Map<string, string>();
    private static idCounter = 0;

    /**
     * Create a short ID for a full index and store mapping
     */
    static createId(fullIndex: string): string {
        const shortId = `idx_${this.idCounter++}`;
        this.indexMap.set(shortId, fullIndex);
        return shortId;
    }

    /**
     * Get the full index for a short ID
     */
    static getFullIndex(shortId: string): string {
        return this.indexMap.get(shortId) || shortId; // Fallback to treating as full index
    }

    /**
     * Compare two indices (can be short IDs or full indices)
     */
    static compare(
        index1: string,
        index2: string,
        direction: OrderDirection = OrderDirection.BOTTOM_TO_TOP
    ): CompareResult {
        // Resolve to full indices
        const full1 = this.indexMap.get(index1) || index1;
        const full2 = this.indexMap.get(index2) || index2;

        if (full1 === full2) return CompareResult.SAME;

        const isLess = full1 < full2;

        if (direction === OrderDirection.BOTTOM_TO_TOP) {
            // Larger index = above
            return isLess ? CompareResult.BELOW : CompareResult.ABOVE;
        } else {
            // Smaller index = above (normal ordering)
            return isLess ? CompareResult.ABOVE : CompareResult.BELOW;
        }
    }

    /**
     * Generate an index between two indices
     * Returns a short ID
     */
    static between(belowIndex: string, aboveIndex: string): string {
        const fullBelow = this.indexMap.get(belowIndex) || belowIndex;
        const fullAbove = this.indexMap.get(aboveIndex) || aboveIndex;

        const newFullIndex = this.getInBetween(fullBelow, fullAbove);
        return this.createId(newFullIndex);
    }

    /**
     * Generate an index above the given one
     * Returns a short ID
     */
    static above(belowIndex: string): string {
        const fullBelow = this.indexMap.get(belowIndex) || belowIndex;
        const newFullIndex = this.generateAbove(fullBelow);
        return this.createId(newFullIndex);
    }

    /**
     * Generate first index (when starting empty)
     */
    static first(): string {
        const TARGET_LENGTH = 8;
        const firstIndex = '!' + this.ascii.charAt(Math.floor(this.base / 2)) + '!'.repeat(TARGET_LENGTH - 2);
        return this.createId(firstIndex);
    }

    /**
     * Clean up unused indices
     */
    static cleanup(activeIds: Set<string>) {
        for (const [shortId, _] of this.indexMap) {
            if (!activeIds.has(shortId)) {
                this.indexMap.delete(shortId);
            }
        }
    }

    /**
     * Get memory stats
     */
    static getStats() {
        let totalChars = 0;
        for (const [_, fullIndex] of this.indexMap) {
            totalChars += fullIndex.length;
        }

        return {
            totalMappings: this.indexMap.size,
            totalChars,
            averageIndexLength: this.indexMap.size > 0 ? totalChars / this.indexMap.size : 0,
            estimatedMemoryMB: (totalChars * 2) / (1024 * 1024) // Rough estimate
        };
    }

    // Add a method to check if rebalancing is needed
    static needsRebalancing(): boolean {
        let totalLength = 0;
        let count = 0;
        for (const [_, fullIndex] of this.indexMap) {
            totalLength += fullIndex.length;
            count++;
            if (fullIndex.length > 100) { // Threshold for "too long"
                return true;
            }
        }
        // Also check average length as a heuristic
        if (count > 0 && (totalLength / count) > 60) {
            return true;
        }
        return false;
    }

    // ============= Private Implementation Methods =============

    private static getInBetween(below: string, above: string): string {
        // Validation
        if (below >= above) {
            // Check if they're extremely close (like differing by just one ~)
            if (below.length > 100 && above.length > 100) {
                // Indices are too long, need rebalancing
                throw new Error(`Indices too long and too close. Rebalancing needed. Below length: ${below.length}, Above length: ${above.length}`);
            }
            throw new Error(`Below must be less than above (below: ${below.substring(0, 50)}..., above: ${above.substring(0, 50)}...)`);
        }
        if (above === "" || below === "") {
            throw new Error("Above and below must be non-empty");
        }
        if (above === below) {
            throw new Error("Above and below must be different");
        }

        const aboveLen = above.length;
        const belowLen = below.length;

        if (aboveLen === belowLen) {
            return this.handleSameLength(below, above);
        } else if (aboveLen > belowLen) {
            return this.handleAboveLonger(below, above);
        } else {
            return this.handleBelowLonger(below, above);
        }
    }

    private static generateAbove(below: string): string {
        const TARGET_LENGTH = 8;

        if (!below) {
            return '!' + this.ascii.charAt(Math.floor(this.base / 2)) + '!'.repeat(TARGET_LENGTH - 2);
        }

        if (below.length < TARGET_LENGTH) {
            let result = below;
            for (let i = below.length; i < TARGET_LENGTH; i++) {
                const charIndex = Math.floor(this.base * (i - below.length + 1) / (TARGET_LENGTH - below.length + 1));
                result += this.ascii.charAt(charIndex);
            }
            return result;
        }

        const lastChar = below.charAt(below.length - 1);
        const lastIndex = this.ascii.indexOf(lastChar);

        if (lastIndex < this.base - 1) {
            const newChar = this.ascii.charAt(lastIndex + 1);
            return below.substring(0, below.length - 1) + newChar;
        }

        return below + '!';
    }

    private static handleBelowLonger(below: string, above: string): string {
        const lastPosAbove = above.length - 1;
        const belowCharAtLastPos = below.charAt(lastPosAbove);
        const aboveCharAtLastPos = above.charAt(lastPosAbove);

        if (belowCharAtLastPos === aboveCharAtLastPos) {
            const belowPrefix = below.substring(0, above.length);
            return this.handleSameLength(belowPrefix, above);
        }

        let result = below.substring(0, lastPosAbove);
        const belowIndex = this.ascii.indexOf(belowCharAtLastPos);
        const aboveIndex = this.ascii.indexOf(aboveCharAtLastPos);

        if (aboveIndex - belowIndex > 1) {
            const midIndex = Math.floor((belowIndex + aboveIndex) / 2);
            result += this.ascii.charAt(midIndex);
            return result;
        }

        result += belowCharAtLastPos;

        for (let i = above.length; i < below.length; i++) {
            const scanChar = below.charAt(i);
            if (scanChar !== '~') {
                if (i > above.length) {
                    result += below.substring(above.length, i);
                }
                const scanIndex = this.ascii.indexOf(scanChar);
                result += this.ascii.charAt(scanIndex + 1);
                return result;
            }
        }

        result += below.substring(above.length);
        const midIndex = Math.floor(this.base / 2);
        result += this.ascii.charAt(midIndex);
        return result;
    }

    private static handleSameLength(below: string, above: string): string {
        let result = "";

        for (let i = 0; i < below.length; i++) {
            const belowChar = below.charAt(i);
            const aboveChar = above.charAt(i);
            const belowIndex = this.ascii.indexOf(belowChar);
            const aboveIndex = this.ascii.indexOf(aboveChar);

            if (belowIndex === -1 || aboveIndex === -1) {
                throw new Error("Invalid character in below or above");
            }

            if (belowChar === aboveChar) {
                result += belowChar;
            } else {
                if (aboveIndex - belowIndex > 1) {
                    const midIndex = Math.floor((belowIndex + aboveIndex) / 2);
                    result += this.ascii.charAt(midIndex);
                    return result;
                } else {
                    if (i === below.length - 1) {
                        result += belowChar;
                        const midIndex = Math.floor(this.base / 2);
                        result += this.ascii.charAt(midIndex);
                        return result;
                    } else {
                        result += belowChar;

                        let scanPos = i + 1;
                        while (scanPos < below.length) {
                            const scanChar = below.charAt(scanPos);
                            if (scanChar !== '~') {
                                const scanIndex = this.ascii.indexOf(scanChar);

                                for (let j = i + 1; j < scanPos; j++) {
                                    result += below.charAt(j);
                                }

                                if (scanIndex < this.base - 1) {
                                    result += this.ascii.charAt(scanIndex + 1);
                                    return result;
                                } else {
                                    throw new Error("Logic error: found '~' when expecting non-'~'");
                                }
                            }
                            scanPos++;
                        }

                        for (let j = i + 1; j < below.length; j++) {
                            result += below.charAt(j);
                        }
                        const midIndex = Math.floor(this.base / 2);
                        result += this.ascii.charAt(midIndex);
                        return result;
                    }
                }
            }
        }

        throw new Error("Logic error: completed loop without finding difference");
    }

    private static handleAboveLonger(below: string, above: string): string {
        const prefixMatch = above.startsWith(below);

        if (!prefixMatch) {
            const abovePrefix = above.substring(0, below.length);
            let result = this.handleSameLength(below, abovePrefix);
            return result + this.ascii.charAt(Math.floor(this.base / 2)) + '~';
        }

        let result = below;

        for (let i = below.length; i < above.length; i++) {
            const scanChar = above.charAt(i);
            if (scanChar !== '!') {
                if (i > below.length) {
                    result += above.substring(below.length, i);
                }
                const scanIndex = this.ascii.indexOf(scanChar);
                result += this.ascii.charAt(scanIndex - 1);
                return result + this.ascii.charAt(Math.floor(this.base / 2)) + '~';
            }
        }

        result += '~';
        return result;
    }
}

export { Indexer };
