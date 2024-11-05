"use strict";

// So I implemented a Tournament Tree originally, but that did not work out well. You can check
// the previous commits for the difference. There was some sort of bug in it, so hopefully
// you're reading this one. I do think that the Tournament Tree was probably a better
// solution for large number of log sources.

/*
 * Assumptions Made:
 *   - Log sources are not being continuously hydrated so we can ditch references to source index
 *   - Logs contain valid data
 */

class MinHeap {
  constructor() {
    this.heap = [];
  }

  insert(logEntry) {
    this.heap.push(logEntry);
    this.bubbleUp();
  }

  bubbleUp() {
    let index = this.heap.length - 1;
    const element = this.heap[index];

    while (index > 0) {
      let parentIndex = Math.floor((index - 1) / 2);
      let parent = this.heap[parentIndex];

      if (element.date >= parent.date) break;

      this.heap[index] = parent;
      index = parentIndex;
    }
    this.heap[index] = element;
  }

  extractMin() {
    const min = this.heap[0];
    const end = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = end;
      this.sinkDown();
    }
    return min;
  }

  /*
    Compares the current element with its children and swaps it down until every parent node
    is less than its children. 
  */
  sinkDown() {
    let index = 0;
    const length = this.heap.length;
    const element = this.heap[0];

    while (true) {
      let leftChildIndex = 2 * index + 1;
      let rightChildIndex = 2 * index + 2;
      let swap = null;

      if (leftChildIndex < length) {
        let leftChild = this.heap[leftChildIndex];
        if (leftChild.date < element.date) {
          swap = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        let rightChild = this.heap[rightChildIndex];
        if ((swap === null && rightChild.date < element.date) || 
            (swap !== null && rightChild.date < this.heap[swap].date)) {
          swap = rightChildIndex;
        }
      }

      if (swap === null) break;

      // Destructuring like this is a little weird, but still readable I think
      [this.heap[index], this.heap[swap]] = [this.heap[swap], this.heap[index]];
      index = swap;
    }
    this.heap[index] = element;
  }

  size() {
    return this.heap.length;
  }
}

module.exports = async function asyncSortedMerge(logSources, printer) {
  const minHeap = new MinHeap();
  const currentEntries = new Array(logSources.length); 
  const entryToSourceIndex = new Map(); // Map to store entry to source index relationship

  // Initialize the min-heap with the first entry of each log source
  await Promise.all(logSources.map(async (source, index) => {
    const entry = await source.popAsync();
    currentEntries[index] = entry; // Store the initial entries
    if (entry) {
      minHeap.insert(entry);
      entryToSourceIndex.set(entry, index); // Maintain a mapping for quick access
    }
  }));

  while (minHeap.size() > 0) {
    const minEntry = minHeap.extractMin();
    printer.print(minEntry);

    // Get the source index directly from the map
    const sourceIndex = entryToSourceIndex.get(minEntry);

    // Get the next entry from the same source asynchronously
    const nextEntry = await logSources[sourceIndex].popAsync();
    currentEntries[sourceIndex] = nextEntry; // Update the current entry

    // If there's a next entry, insert it into the min-heap and update the map
    if (nextEntry) {
      minHeap.insert(nextEntry);
      entryToSourceIndex.set(nextEntry, sourceIndex); // Update the map with the new entry
    } else {
      entryToSourceIndex.delete(minEntry); // Remove the entry from the map if it's no longer valid
    }
  }

  printer.done();
};
