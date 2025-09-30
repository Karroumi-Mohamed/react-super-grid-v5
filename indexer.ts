import { generateKeyBetween } from "fractional-indexing";
import { Indexer } from "./src/SupperGrid/core/Indexer";



// test 10k
const indexes: string[] = [];
const start = performance.now();
indexes.push(Indexer.above());
for (let i = 0; i < 5000; i++) {
    indexes.push(Indexer.above(indexes[i]));
}
const end = performance.now();
console.log(`Time taken: ${end - start} ms`);
console.log("last index:", Indexer.getIndex(indexes[indexes.length - 1]));

console.log(`Total indexes generated: ${indexes.length}`);
let isOrdered = true;
for (let i = 1; i < indexes.length; i++) {
    const prev = Indexer.getIndex(indexes[i - 1])!;
    const curr = Indexer.getIndex(indexes[i])!;
    if (prev >= curr) {
        console.error(`Order error at position ${i}: ${prev} >= ${curr}`);
        isOrdered = false;
        break;
    }
}
if (isOrdered) {
    console.log("All indexes are in correct order.");
} else {
    throw new Error("Indexes are not in order!");
}

// starting inbetween tests at the end
let start2 = performance.now();
for (let i = indexes.length - 1; i < 7500; i++) {
    const index = Indexer.between(indexes[i - 1], indexes[i]);
    const last = indexes.pop();
    indexes.push(index);
    indexes.push(last!);
}
let end2 = performance.now();
console.log(`Time taken for inbetween: ${end2 - start2} ms`);
console.log("last index:", Indexer.getIndex(indexes[indexes.length - 1]));
console.log("Total indexes generated:", indexes.length);

for (let i = 0; i < 100; i++) {
    console.log(Indexer.getIndex(indexes[i]));

}
//starting 10k inbetween tests at the start
start2 = performance.now();
for (let i = 0; i < 2500; i++) {


    const index = Indexer.between(indexes[0], indexes[1]);
    const first = indexes.shift();
    indexes.unshift(index);
    indexes.unshift(first!);
}
end2 = performance.now();
const below = generateKeyBetween(null, null);
const above = generateKeyBetween(below, null);
// compare
if (below.localeCompare(above) >= 0) {
    throw new Error("Order error in fractional-indexing");
}

const indexBelow = Indexer.above();
const indexAbove = Indexer.above(indexBelow);
// checking order
if (Indexer.compare(indexBelow, indexAbove) >= 0) {
    throw new Error("Order error in Indexer.above()");

}



const saveActionMethod = (tableAPIs: CellTableAPI, newValue: any){
    // dir shi haja hnaya
    tableAPIs.save(newValue);
    tableAPIs.releaseKeyboard();
// due to how action system will work, dont add logic out of the given tableAPIs methods
}
apiUsage = [["save", newValue], ["releaseKeyboard"]]

registerActions({
    "saveAction": saveActionMethod,
    "exitAction": (tableAPIs: CellTableAPI) => { console.log("exit action triggered"); },
})


runAction("saveAction", "new value");

// plugins

onBeforeAction(cellId, actionName, apiUsage): boolean{
}
