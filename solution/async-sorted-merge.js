class TournamentTree {
  constructor(logSources, caches) {
    this.logSources = logSources;
    this.caches = caches;
    this.tree = Array(2 * logSources.length - 1).fill(null); // Tree with leaves and intermediate nodes
    this.updateCacheSize(logSources.length); // Ensure cache size is updated before building the tree
  }

  updateCacheSize(numSources) {
    // Dynamically calculate the cache size based on the number of sources
    this.MAX_CACHE_SIZE = Math.max(Math.floor(100000000 / numSources), 10); // Ensure a minimum cache size of 10
    this.cacheSize = Math.max(this.MAX_CACHE_SIZE, 1);
  }

  async buildTree() {
    // Preload cache entries for all sources concurrently
    await Promise.all(
      this.logSources.map((source, index) => loadCache(source, this.caches[index], this.cacheSize))
    );

    const leavesStart = this.logSources.length - 1;
    for (let i = 0; i < this.logSources.length; i++) {
      if (this.caches[i].length > 0) {
        this.tree[leavesStart + i] = { ...this.caches[i].shift(), sourceIndex: i };
      }
    }

    // Build the tournament tree by sending winners up to the root
    for (let i = leavesStart - 1; i >= 0; i--) {
      this.tree[i] = this.getWinner(this.tree[2 * i + 1], this.tree[2 * i + 2]);
    }
  }

  getWinner(left, right) {
    if (!left && !right) return null;
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
  
    // Only refill the cache if it is below the threshold, to minimize cache reloads
    if (this.caches[sourceIndex].length <= 1) {
      await this.loadCacheIfNeeded(sourceIndex);
    }
  
    // Replace the minimum entry with the next entry from the same source cache
    const nextEntry = this.caches[sourceIndex].shift() || null;
    const leavesStart = this.logSources.length - 1;
    this.tree[leavesStart + sourceIndex] = nextEntry
      ? { ...nextEntry, sourceIndex }
      : null;
  
    // Update the tree from the leaf up to maintain tournament structure
    for (let i = Math.floor((leavesStart + sourceIndex - 1) / 2); i >= 0; i = Math.floor((i - 1) / 2)) {
      this.tree[i] = this.getWinner(this.tree[2 * i + 1], this.tree[2 * i + 2]);
    }
  
    if (this.caches[sourceIndex].length === 0) {
      const activeSources = this.logSources.filter((_, idx) => this.caches[idx].length > 0).length;
  
      // Only update the cache size if there are still active sources left
      if (activeSources > 0) {
        this.updateCacheSize(activeSources); // Recalculate cache size for remaining sources
      } else {
        // If no active sources remain, ensure the tree stops being updated
        return;
      }
    }
  }
  

  // Efficiently loads the cache for a specific source if needed
  async loadCacheIfNeeded(sourceIndex) {
    if (this.caches[sourceIndex].length < this.cacheSize / 2) {
      // Load more logs from the source, but ensure this happens concurrently for multiple sources
      await loadCache(this.logSources[sourceIndex], this.caches[sourceIndex], this.cacheSize);
    }
  }
}

async function loadCache(logSource, cache, maxSize) {
  // Preload logs asynchronously until the cache reaches the max size
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
