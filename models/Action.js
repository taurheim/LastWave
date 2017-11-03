function Action() {
    this.getOptions();

    /**
     * Perform the action on some data (e.g. draw a graph to represent some given data)
     * @param {} data This this should be a dict of items keyed by name, each one with some "count". There may be additional information necessary to perform the action, but each action should first validate the data.
     */
    this.performAction(data);
}