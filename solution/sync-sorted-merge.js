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
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
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
      let leftChild, rightChild;
      let swap = null;

      if (leftChildIndex < length) {
        leftChild = this.heap[leftChildIndex];
        if (leftChild.date < element.date) {
          swap = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        rightChild = this.heap[rightChildIndex];
        if (
          (swap === null && rightChild.date < element.date) ||
          (swap !== null && rightChild.date < leftChild.date)
        ) {
          swap = rightChildIndex;
        }
      }

      if (swap === null) break;

      this.heap[index] = this.heap[swap];
      index = swap;
    }
    this.heap[index] = element;
  }

  size() {
    return this.heap.length;
  }
}

module.exports = function syncSortedMerge(logSources, printer) {
  const minHeap = new MinHeap();
  const entrySources = logSources.map(source => ({
    source,
    nextEntry: source.pop(), 
  }));

  // Initialize the min-heap with the first entry of each log source
  entrySources.forEach(({ nextEntry }) => {
    if (nextEntry) {
      minHeap.insert(nextEntry);
    }
  });

  while (minHeap.size() > 0) {
    const minEntry = minHeap.extractMin();
    printer.print(minEntry);

    // Find the source that provided this entry
    const entrySource = entrySources.find(({ nextEntry }) => nextEntry === minEntry);
    
    // Get the next entry from the same source
    entrySource.nextEntry = entrySource.source.pop();
    
    // If there's a next entry, insert it into the min-heap
    if (entrySource.nextEntry) {
      minHeap.insert(entrySource.nextEntry);
    }
  }

  printer.done();
};