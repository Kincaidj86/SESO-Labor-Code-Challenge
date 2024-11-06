"use strict";

class TournamentTree {
  constructor(logSources) {
    this.logSources = logSources;
    this.tree = Array(2 * logSources.length - 1).fill(null);
  }

  buildTree() {
    const leavesStart = this.logSources.length - 1;

    // Initializing the leaves with the first log entries from each source
    for (let i = 0; i < this.logSources.length; i++) {
      const entry = this.logSources[i].pop();
      if (entry) {
        this.tree[leavesStart + i] = { ...entry, sourceIndex: i };
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

  getMin() {
    return this.tree[0]; 
  }

  replaceMin() {
    const minEntry = this.getMin();
    if (!minEntry) return;

    const sourceIndex = minEntry.sourceIndex;

    // Replace the minimum entry with the next entry from the same source
    const nextEntry = this.logSources[sourceIndex].pop() || null;
    const leavesStart = this.logSources.length - 1;

    this.tree[leavesStart + sourceIndex] = nextEntry
      ? { ...nextEntry, sourceIndex }
      : null;

    // Update the tree from the leaf up to maintain tournament structure. Okay, this math isn't the most pleasant.
    for (let i = Math.floor((leavesStart + sourceIndex - 1) / 2); i >= 0; i = Math.floor((i - 1) / 2)) {
      this.tree[i] = this.getWinner(this.tree[2 * i + 1], this.tree[2 * i + 2]);
    }
  }
}

module.exports = function syncSortedMerge(logSources, printer) {
  const tournamentTree = new TournamentTree(logSources);

  // Build the initial tree with the first entries from each source
  tournamentTree.buildTree();

  while (true) {
    const minEntry = tournamentTree.getMin();

    // All sources are drained
    if (!minEntry) break;

    printer.print(minEntry);

    // Rebalance the tree with the next entry from the source we just printed
    tournamentTree.replaceMin(); 
  }

  printer.done();
};
