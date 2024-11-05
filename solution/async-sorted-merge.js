"use strict";

/* Node structure for a Tournament Tree. I think it's a better algorithm for this than my initial
 * implementation using a MinHeap; specifically when there are a large number of log sources.
 *
 * Assumptions Made:
 *   - Log sources are not being continuously hydrated so we can ditch references to source index
 *   - Logs contain valid data
 */
class TreeNode {
  constructor(log, sourceIndex, parent = null) {
    this.log = log;
    this.sourceIndex = sourceIndex; // To track which log source needs to be fetched next
    this.parent = parent;
    this.left = null;
    this.right = null;
  }
}

class TournamentTree {
  constructor(sources) {
    this.sources = sources;
    this.root = null;
  }

  async initialize() {
    // Fetch initial logs from all sources asynchronously
    const nodes = await Promise.all(
      this.sources.map(async (source, index) => {
        const log = await source.popAsync();
        return log ? new TreeNode(log, index) : null;
      })
    );

    // Filter out null nodes
    const validNodes = nodes.filter(Boolean);

    // Build the tournament tree
    this.root = this.buildTree(validNodes);
  }

  // Build the tree from the current nodes, return root node or null
  buildTree(nodes, start = 0, end = nodes.length) {
    if (start >= end) return null;
    if (start + 1 === end) return nodes[start];

    const mid = Math.floor((start + end) / 2);
    const leftChild = this.buildTree(nodes, start, mid);
    const rightChild = this.buildTree(nodes, mid, end);

    // Double ternary is sometimes frowned upon, but I think it's still readable. Don't worry,
    // I wouldn't use a triple ternary
    const parentNode = new TreeNode(
      leftChild && rightChild
        ? leftChild.log.date <= rightChild.log.date
          ? leftChild.log
          : rightChild.log
        : (leftChild || rightChild).log,
      leftChild ? leftChild.sourceIndex : rightChild.sourceIndex
    );

    parentNode.left = leftChild;
    parentNode.right = rightChild;

    // Set parent references
    if (leftChild) leftChild.parent = parentNode;
    if (rightChild) rightChild.parent = parentNode;

    return parentNode;
  }

  // Min exists at root
  async replaceMin() {
    const minNode = this.root;
    if (!minNode) return;

    // Fetch the next log entry from the source that provided the minimum log, which is why we stored
    // the source index in the node
    const nextLogFromSource = await this.sources[
      minNode.sourceIndex
    ].popAsync();

    // Assumes that log sources are not being hydrated so we can ditch references to this source index
    const replacement = nextLogFromSource
      ? new TreeNode(nextLogFromSource, minNode.sourceIndex, minNode.parent)
      : null;

    // Update the tree with the new log entry
    this.updateNode(minNode, replacement);
  }

  // Also rebalances, since we want to rebalance every time we update a node
  updateNode(node, replacement) {
    if (replacement) {
      node.log = replacement.log; // Replace log entry
      node.sourceIndex = replacement.sourceIndex; // Update source index
    } else {
      node.log = null;
      node.sourceIndex = -1; // Not necessary, but can be useful for debugging
    }

    // Rebalance the tree upwards after replacement
    this.rebalance(node);
  }

  rebalance(node) {
    let currentNode = node;
    while (currentNode.parent) {
      const parentNode = currentNode.parent;

      const leftChild = parentNode.left;
      const rightChild = parentNode.right;

      // If there are two children, compare, else just use the single child
      parentNode.log =
        leftChild && rightChild
          ? leftChild.log.date <= rightChild.log.date
            ? leftChild.log
            : rightChild.log
          : leftChild || rightChild
          ? (leftChild || rightChild).log
          : null;

      // Same as above, but for the source index. Could probably merge, but I think this is more readable
      parentNode.sourceIndex =
        leftChild && rightChild
          ? leftChild.log.date <= rightChild.log.date
            ? leftChild.sourceIndex
            : rightChild.sourceIndex
          : leftChild
          ? leftChild.sourceIndex
          : rightChild
          ? rightChild.sourceIndex
          : -1;

      // Set the node
      currentNode = parentNode;
    }
  }

  isEmpty() {
    return this.root === null || !this.root.log;
  }
}

// Asynchronous solution using Tournament Tree
module.exports = async function asyncLogDrain(logSources, printer) {
  const tree = new TournamentTree(logSources);
  await tree.initialize();

  // Process entries asynchronously until all sources are drained
  while (!tree.isEmpty()) {
    const minNode = tree.root;
    if (minNode) {
      printer.print(minNode.log);
      await tree.replaceMin();
    }
  }

  printer.done();
};
