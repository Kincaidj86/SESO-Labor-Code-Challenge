"use strict";

class TournamentTree {
  
  constructor(logSources, caches) {
    this.logSources = logSources;
    this.caches = caches;
    this.tree = Array(2 * logSources.length - 1).fill(null); // Tree with leaves and intermediate nodes
    this.MAX_CACHE_SIZE = 500;
  }

  async buildTree() {

    // Load initial entries into caches
    await Promise.all(
      this.logSources.map((source, index) => loadCache(source, this.caches[index], this.MAX_CACHE_SIZE))
    );

    const leavesStart = this.logSources.length - 1;
    for (let i = 0; i < this.logSources.length; i++) {
      if (this.caches[i].length > 0) {
        this.tree[leavesStart + i] = { ...this.caches[i].shift(), sourceIndex: i };
      }
    }

    // Build the tournament tree by sending winners up to the root
    for (let i = leavesStart - 1; i >= 0; i--) {
      // For each internal node, the children are at positions (2*i)+1 and (2*i)+2
      this.tree[i] = this.getWinner(this.tree[2 * i + 1], this.tree[2 * i + 2]);
    }
  }

  getWinner(left, right) {
    if (!left) return right;
    if (!right) return left;
    return left.date <= right.date ? left : right;
  }

  // Minimum is always at root
  getMin() {
    return this.tree[0];
  }

  async replaceMin() {
    const minEntry = this.getMin();
    if (!minEntry) return;

    const sourceIndex = minEntry.sourceIndex;

    // Check if we need to refill the cache for this source
    if (this.caches[sourceIndex].length < this.MAX_CACHE_SIZE / 2) {
      loadCache(this.logSources[sourceIndex], this.caches[sourceIndex], this.MAX_CACHE_SIZE);
    }

    // Replace the minimum entry with the next entry from the same source cache
    const nextEntry = this.caches[sourceIndex].shift() || null;
    const leavesStart = this.logSources.length - 1;
    this.tree[leavesStart + sourceIndex] = nextEntry
      ? { ...nextEntry, sourceIndex }
      : null;

    // Update the tree from the leaf up to maintain tournament structure. Okay, this math still isn't the most pleasant.
    for (let i = Math.floor((leavesStart + sourceIndex - 1) / 2); i >= 0; i = Math.floor((i - 1) / 2)) {
      this.tree[i] = this.getWinner(this.tree[2 * i + 1], this.tree[2 * i + 2]);
    }
  }
}

async function loadCache(logSource, cache, maxSize) {
  while (cache.length < maxSize) {
    const log = await logSource.popAsync();
    if (!log) break;
    cache.push(log);
  }
}

module.exports = async function asyncSortedMerge(logSources, printer) {
  const caches = Array.from({ length: logSources.length }, () => []);
  const tournamentTree = new TournamentTree(logSources, caches);

  // Build the initial tree with the first entries from each source
  await tournamentTree.buildTree(); 

  while (true) {
    const minEntry = tournamentTree.getMin();
        
    // All sources are drained
    if (!minEntry) break; 

    printer.print(minEntry);
    
    // Rebalance the tree with the next entry from the source we just printed
    await tournamentTree.replaceMin();
  }

  printer.done();
};
